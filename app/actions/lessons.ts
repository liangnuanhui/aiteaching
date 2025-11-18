/**
 * LessonCard Management Server Actions
 * Server-side actions for managing lesson cards in a class
 */

'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { ClassRepository, LessonCardRepository } from '@/repositories';

/**
 * Create a new lesson card under a class owned by the current user
 */
export async function createLesson(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/classes');
  }

  const classIdValue = formData.get('classId');
  const titleValue = formData.get('title');

  const classId = Number(classIdValue ?? '');
  const title = (titleValue ?? '').toString().trim();

  if (!classId || !Number.isFinite(classId)) {
    throw new Error('Invalid class id');
  }

  if (!title) {
    throw new Error('Lesson title is required');
  }

  const userId = Number(session.user.id);
  const prisma = createPrismaClient();
  const classRepo = new ClassRepository(prisma);
  const lessonRepo = new LessonCardRepository(prisma);

  const cls = await classRepo.findById(classId);

  if (!cls || cls.teacherId !== userId) {
    throw new Error('You do not have permission to modify this class');
  }

  await lessonRepo.create({
    title,
    classId,
  });

  redirect(`/classes/${classId}`);
}
