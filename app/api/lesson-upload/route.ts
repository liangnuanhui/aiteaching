import { NextRequest, NextResponse } from 'next/server';
import { uploadFile } from '@/lib/storage';
import { FileSizeExceededError, MissingRequiredFieldError } from '@/lib/errors';
import { verifyLessonUploadToken } from '@/lib/lesson-upload-token';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/lesson-upload
 * 课程级学生作品上传（H5 页面使用，不要求登录）
 * body: FormData { file, lessonId, token }
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const lessonIdValue = formData.get('lessonId');
  const tokenValue = formData.get('token');

  if (!file) {
    throw new MissingRequiredFieldError('file');
  }
  if (!lessonIdValue) {
    throw new MissingRequiredFieldError('lessonId');
  }
  if (!tokenValue) {
    throw new MissingRequiredFieldError('token');
  }

  const lessonId = Number(lessonIdValue);
  if (!lessonId || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'Invalid lessonId' }, { status: 400 });
  }

  const token = tokenValue.toString();
  const valid = verifyLessonUploadToken(lessonId, token);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid upload token' }, { status: 403 });
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new FileSizeExceededError(
      `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }

  const timestamp = Date.now();
  const safeName = file.name || 'student-work';
  const filename = `${timestamp}-${safeName}`;
  const key = `lesson_${lessonId}/${filename}`;

  const stored = await uploadFile(key, file, {
    originalName: safeName,
    uploadedAt: new Date().toISOString(),
  });

  if (!stored) {
    return NextResponse.json({ error: 'Storage not available' }, { status: 500 });
  }

  return NextResponse.json({
    key: stored.key,
    size: stored.size,
    url: stored.url,
    contentType: stored.contentType || file.type || 'application/octet-stream',
    name: safeName,
  });
}
