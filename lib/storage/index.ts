/**
 * Storage Abstraction Layer
 * Supports both local filesystem (development) and R2 storage (production)
 * Configuration via STORAGE_TYPE environment variable:
 * - 'local': Use local filesystem (/tmp/uploads)
 * - 'r2': Use Cloudflare R2 bucket (requires R2 bindings)
 * Defaults to 'local' when no R2 is available
 */

import { getCloudflareEnv } from '@/lib/db/client';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getLocalUploadDir } from '@/lib/storage/paths';

export interface StorageMetadata {
  contentType?: string;
  customMetadata?: Record<string, string>;
}

export interface StoredFile {
  key: string;
  url: string;
  size?: number;
  contentType?: string;
  uploadedAt?: string;
}

type UploadInput = File | Blob | Buffer | Uint8Array;

interface UploadFileOptions {
  metadata?: Record<string, string>;
  contentType?: string;
}

/**
 * Abstract storage interface
 */
export interface IStorage {
  put(
    key: string,
    value: Buffer | ReadableStream | string,
    metadata?: StorageMetadata
  ): Promise<StoredFile | null>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

/**
 * Local filesystem storage implementation (for development)
 */
export class LocalStorage implements IStorage {
  private basePath: string;
  private baseUrl: string;

  constructor(basePath: string = '/tmp/uploads') {
    this.basePath = basePath;
    this.baseUrl = '/api/storage/local/';
  }

  async put(
    key: string,
    value: Buffer | ReadableStream | string,
    metadata?: StorageMetadata
  ): Promise<StoredFile | null> {
    try {
      // Ensure directory exists
      const fullPath = join(this.basePath, key);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      await fs.mkdir(dir, { recursive: true });

      // Handle different input types
      if (value instanceof Buffer) {
        await fs.writeFile(fullPath, value);
      } else if (typeof value === 'string') {
        await fs.writeFile(fullPath, value);
      } else {
        // Handle ReadableStream (e.g., from file uploads)
        const buffer = await streamToBuffer(value as unknown as ReadableStream);
        await fs.writeFile(fullPath, buffer);
      }

      const stats = await fs.stat(fullPath);

      return {
        key,
        url: this.getUrl(key),
        size: stats.size,
        contentType: metadata?.contentType || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Local storage put error:', error);
      return null;
    }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const fullPath = join(this.basePath, key);
      return await fs.readFile(fullPath);
    } catch (error) {
      console.error('Local storage get error:', error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fullPath = join(this.basePath, key);
      await fs.unlink(fullPath);
    } catch (error) {
      console.error('Local storage delete error:', error);
    }
  }

  getUrl(key: string): string {
    // In development, serve local files via API route
    return `${this.baseUrl}${key}`;
  }
}

/**
 * R2 storage adapter (for production)
 */
export class R2Storage implements IStorage {
  private bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.bucket = bucket;
  }

  async put(
    key: string,
    value: Buffer | ReadableStream | string,
    metadata?: StorageMetadata
  ): Promise<StoredFile | null> {
    try {
      const arrayBuffer =
        value instanceof Buffer
          ? value
          : typeof value === 'string'
            ? Buffer.from(value)
            : await streamToBuffer(value as unknown as ReadableStream);

      const object = await this.bucket.put(key, arrayBuffer, {
        httpMetadata: {
          contentType: metadata?.contentType || 'application/octet-stream',
        },
        customMetadata: metadata?.customMetadata,
      });

      if (!object) return null;

      return {
        key: object.key,
        url: `/api/storage/r2/${object.key}`, // Will be served by API route
        size: object.size,
        contentType: object.httpMetadata?.contentType,
        uploadedAt: object.uploaded?.toISOString(),
      };
    } catch (error) {
      console.error('R2 storage put error:', error);
      return null;
    }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const object = await this.bucket.get(key);
      if (!object) return null;

      const arrayBuffer = await object.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('R2 storage get error:', error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.bucket.delete(key);
    } catch (error) {
      console.error('R2 storage delete error:', error);
    }
  }

  getUrl(key: string): string {
    return `/api/storage/r2/${key}`;
  }
}

/**
 * Factory function to create storage instance based on environment
 */
export function createStorage(): IStorage | null {
  const storageType = process.env.STORAGE_TYPE || 'auto';
  const env = getCloudflareEnv();

  // Auto-detect: Use R2 if available, otherwise local
  if (storageType === 'auto') {
    if (env?.BUCKET) {
      console.log('✅ Using R2 storage (Cloudflare environment detected)');
      return new R2Storage(env.BUCKET);
    } else {
      console.log('⚠️ Using local filesystem storage (no R2 bucket detected)');
      const uploadDir = getLocalUploadDir();
      console.log(`📁 Upload directory: ${uploadDir}`);
      return new LocalStorage(uploadDir);
    }
  }

  // Explicit local mode
  if (storageType === 'local') {
    const uploadDir = getLocalUploadDir();
    console.log(`⚠️ Using LOCAL filesystem storage: ${uploadDir}`);
    return new LocalStorage(uploadDir);
  }

  // Explicit R2 mode
  if (storageType === 'r2') {
    if (!env?.BUCKET) {
      console.error('❌ R2 storage requested but no bucket available');
      return null;
    }
    console.log('✅ Using R2 storage');
    return new R2Storage(env.BUCKET);
  }

  console.error(`❌ Unknown STORAGE_TYPE: ${storageType}`);
  return null;
}

/**
 * Primary storage instance (singleton)
 */
export const storage = createStorage();

/**
 * Upload file (wrapper that handles both storage types)
 * Signature matches the existing uploadFile utility
 */
const isBlobLike = (value: unknown): value is File | Blob =>
  typeof value === 'object' &&
  value !== null &&
  'arrayBuffer' in (value as File | Blob) &&
  typeof (value as File | Blob).arrayBuffer === 'function';

export async function uploadFile(
  key: string,
  file: UploadInput,
  options: UploadFileOptions = {}
): Promise<StoredFile | null> {
  const store = storage;
  if (!store) {
    console.error('❌ No storage available');
    return null;
  }

  const { metadata, contentType: providedContentType } = options;
  let buffer: Buffer;
  let resolvedContentType = providedContentType;

  if (Buffer.isBuffer(file)) {
    buffer = file;
  } else if (file instanceof Uint8Array) {
    buffer = Buffer.from(file);
  } else if (isBlobLike(file)) {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    resolvedContentType = resolvedContentType || file.type || 'application/octet-stream';
  } else {
    throw new Error('Unsupported upload input type');
  }

  if (!resolvedContentType) {
    resolvedContentType = 'application/octet-stream';
  }

  return await store.put(key, buffer, {
    contentType: resolvedContentType,
    customMetadata: metadata,
  });
}

/**
 * Download file (wrapper)
 */
export async function downloadFile(key: string): Promise<Buffer | null> {
  const store = storage;
  if (!store) {
    console.error('❌ No storage available');
    return null;
  }

  return await store.get(key);
}

/**
 * Delete file (wrapper)
 */
export async function deleteFile(key: string): Promise<void> {
  const store = storage;
  if (!store) {
    console.error('❌ No storage available');
    return;
  }

  await store.delete(key);
}

/**
 * Helper: Convert ReadableStream to Buffer
 */
async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const concatenated = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    concatenated.set(chunk, offset);
    offset += chunk.length;
  }

  return Buffer.from(concatenated);
}
