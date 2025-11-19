/**
 * Image processing utilities for OCR
 * - Base64 encoding
 * - HEIC format support (via sharp if needed)
 * - File validation
 */

import fs from 'fs';
import path from 'path';

/**
 * Supported image formats
 */
export const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

/**
 * Check if file is a supported image format
 */
export function isSupportedImageFormat(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_IMAGE_FORMATS.includes(ext);
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.heic': 'image/jpeg', // HEIC will be converted to JPEG
    '.heif': 'image/jpeg',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

/**
 * Check if file is HEIC format
 */
export function isHeicFormat(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.heic' || ext === '.heif';
}

/**
 * Convert image file to Base64 string
 *
 * For HEIC files, this function currently reads them as-is.
 * If ModelScope doesn't support HEIC, you'll need to add the 'sharp' library:
 *
 * ```bash
 * npm install sharp
 * ```
 *
 * Then uncomment the HEIC conversion logic below.
 */
export async function imageToBase64(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Image file not found: ${filePath}`);
  }

  if (!isSupportedImageFormat(filePath)) {
    throw new Error(
      `Unsupported image format: ${path.extname(filePath)}. Supported formats: ${SUPPORTED_IMAGE_FORMATS.join(', ')}`
    );
  }

  // For HEIC files, convert to JPEG first
  // NOTE: Uncomment this if ModelScope doesn't support HEIC natively
  // if (isHeicFormat(filePath)) {
  //   const sharp = require('sharp');
  //   const buffer = await sharp(filePath).jpeg().toBuffer();
  //   return buffer.toString('base64');
  // }

  // For other formats, read directly
  const buffer = fs.readFileSync(filePath);
  return buffer.toString('base64');
}

/**
 * Create data URL from file path
 * Returns: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
 */
export async function imageToDataURL(filePath: string): Promise<string> {
  const base64 = await imageToBase64(filePath);
  const mimeType = getMimeType(filePath);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Get image file size in bytes
 */
export function getImageFileSize(filePath: string): number {
  const stats = fs.statSync(filePath);
  return stats.size;
}

/**
 * Validate image file size (max 10MB)
 */
export function validateImageSize(filePath: string, maxSizeBytes: number = 10 * 1024 * 1024): void {
  const size = getImageFileSize(filePath);
  if (size > maxSizeBytes) {
    throw new Error(
      `Image file too large: ${(size / 1024 / 1024).toFixed(2)}MB (max: ${(maxSizeBytes / 1024 / 1024).toFixed(2)}MB)`
    );
  }
}
