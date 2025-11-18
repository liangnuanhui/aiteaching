import { NextRequest } from 'next/server';
import { withMiddleware, withApiHandler } from '@/lib/api';
import { auth } from '@/lib/auth/config';
import { AuthenticationError, ValidationError } from '@/lib/errors';
import { generateLessonForClass } from '@/services/lesson-generator';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return withMiddleware(request, () =>
    withApiHandler(async () => {
      const session = await auth();

      if (!session?.user?.id) {
        throw new AuthenticationError('请先登录');
      }

      let payload: { classId?: number; title?: string };

      try {
        payload = await request.json();
      } catch (error) {
        throw new ValidationError('Invalid JSON body', error);
      }

      const classId = Number(payload.classId ?? 0);
      const title = (payload.title ?? '').trim();

      if (!classId || !Number.isFinite(classId)) {
        throw new ValidationError('classId is required and must be a valid number');
      }

      if (!title) {
        throw new ValidationError('title is required');
      }

      const lesson = await generateLessonForClass({
        teacherId: Number(session.user.id),
        classId,
        title,
      });

      return {
        id: lesson.id,
        title: lesson.title,
        classId: lesson.classId,
      };
    })
  );
}
