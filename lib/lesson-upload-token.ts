/**
 * Lesson upload token helper
 * 用于生成和校验课程级上传令牌（二维码中使用），无过期时间。
 * 令牌依赖 NEXTAUTH_SECRET，因此一旦更换 secret，旧二维码会自动失效。
 */

import crypto from 'crypto';

const SECRET = process.env.NEXTAUTH_SECRET || 'default-upload-secret';

export function getLessonUploadToken(lessonId: number): string {
  const h = crypto.createHash('sha256');
  h.update(`lesson-upload:${lessonId}:${SECRET}`);
  return h.digest('hex').slice(0, 32);
}

export function verifyLessonUploadToken(
  lessonId: number,
  token: string | null | undefined
): boolean {
  if (!token) return false;
  return token === getLessonUploadToken(lessonId);
}
