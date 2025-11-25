/**
 * Student Management Server Actions
 * Server-side actions for managing students in a class
 */

'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { ClassRepository, StudentRepository } from '@/repositories';

// Force Node.js runtime - auth() requires Prisma
export const runtime = 'nodejs';

/**
 * Create a new student under a class owned by the current user
 */
export async function createStudent(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/classes');
  }

  const classIdValue = formData.get('classId');
  const nameValue = formData.get('name');
  const nicknameValue = formData.get('nickname');

  const classId = Number(classIdValue ?? '');
  const name = (nameValue ?? '').toString().trim();
  const nickname = (nicknameValue ?? '').toString().trim();

  if (!classId || !Number.isFinite(classId)) {
    throw new Error('Invalid class id');
  }

  if (!name) {
    throw new Error('Student name is required');
  }

  const userId = Number(session.user.id);
  const prisma = createPrismaClient();
  const classRepo = new ClassRepository(prisma);
  const studentRepo = new StudentRepository(prisma);

  const cls = await classRepo.findById(classId);

  if (!cls || cls.teacherId !== userId) {
    throw new Error('You do not have permission to modify this class');
  }

  await studentRepo.create({
    name,
    nickname: nickname || null,
    classId,
  });

  redirect(`/classes/${classId}/students`);
}

/**
 * Delete a student from a class owned by the current user
 */
export async function deleteStudent(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/classes');
  }

  const classIdValue = formData.get('classId');
  const studentIdValue = formData.get('studentId');

  const classId = Number(classIdValue ?? '');
  const studentId = Number(studentIdValue ?? '');

  if (!classId || !Number.isFinite(classId)) {
    throw new Error('Invalid class id');
  }

  if (!studentId || !Number.isFinite(studentId)) {
    throw new Error('Invalid student id');
  }

  const userId = Number(session.user.id);
  const prisma = createPrismaClient();
  const classRepo = new ClassRepository(prisma);
  const studentRepo = new StudentRepository(prisma);

  const cls = await classRepo.findById(classId);

  if (!cls || cls.teacherId !== userId) {
    throw new Error('You do not have permission to modify this class');
  }

  await studentRepo.delete(studentId, classId);

  redirect(`/classes/${classId}/students`);
}

/**
 * Update a student's nickname within a class owned by the current user
 */
export async function updateStudentNickname(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/classes');
  }

  const classIdValue = formData.get('classId');
  const studentIdValue = formData.get('studentId');
  const nicknameValue = formData.get('nickname');

  const classId = Number(classIdValue ?? '');
  const studentId = Number(studentIdValue ?? '');
  const nickname = (nicknameValue ?? '').toString().trim();

  if (!classId || !Number.isFinite(classId)) {
    throw new Error('Invalid class id');
  }

  if (!studentId || !Number.isFinite(studentId)) {
    throw new Error('Invalid student id');
  }

  const userId = Number(session.user.id);
  const prisma = createPrismaClient();
  const classRepo = new ClassRepository(prisma);
  const studentRepo = new StudentRepository(prisma);

  const cls = await classRepo.findById(classId);

  if (!cls || cls.teacherId !== userId) {
    throw new Error('You do not have permission to modify this class');
  }

  await studentRepo.updateNickname(studentId, classId, nickname || null);

  redirect(`/classes/${classId}/students`);
}
