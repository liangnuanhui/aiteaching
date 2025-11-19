import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';

// GET /api/storage/local/:key*
export async function GET(_request: NextRequest, { params }: { params: { key: string[] } }) {
  try {
    const key = params.key.join('/');
    const uploadDir = process.env.LOCAL_UPLOAD_DIR || './uploads';
    const filePath = join(uploadDir, key);

    // Security: Prevent directory traversal
    const resolvedPath = await fs.realpath(filePath);
    const resolvedDir = await fs.realpath(uploadDir);

    if (!resolvedPath.startsWith(resolvedDir)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 403 });
    }

    // Check if file exists
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Read file
    const file = await fs.readFile(resolvedPath);

    // Infer content type from file extension
    const ext = key.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      pdf: 'application/pdf',
      txt: 'text/plain',
      json: 'application/json',
      html: 'text/html',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
    };

    const contentType = contentTypes[ext || ''] || 'application/octet-stream';

    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: unknown) {
    console.error('Error serving local file:', error);

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
