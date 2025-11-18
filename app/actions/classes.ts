/**
 * Class Management Server Actions
 * Server-side actions for creating teaching classes
 */

'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { ClassRepository } from '@/repositories';

/**
 * Create a new class for the current user
 */
export async function createClass(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/classes');
  }

  const name = (formData.get('name') ?? '').toString().trim();
  const gradeLevel = (formData.get('gradeLevel') ?? '').toString().trim();

  if (!name || !gradeLevel) {
    throw new Error('Class name and grade level are required');
  }

  const prisma = createPrismaClient();
  const repo = new ClassRepository(prisma);

  await repo.create({
    name,
    gradeLevel,
    teacherId: Number(session.user.id),
  });

  redirect('/classes');
}
