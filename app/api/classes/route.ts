import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/client';
import { createdResponse, successResponse, withRepositories } from '@/lib/api';
import { ValidationError, ResourceNotFoundError } from '@/lib/errors';

export const runtime = 'nodejs';

// GET /api/classes - list classes for authenticated teacher
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teacherId = Number(session.user.id);
    const classes = await prisma.class.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ classes });
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/classes - create a new class
export async function POST(request: NextRequest) {
  return withRepositories(request, async repos => {
    let body: { name?: string; gradeLevel?: string; teacherId?: number };

    try {
      body = await request.json();
    } catch (error) {
      throw new ValidationError('Invalid JSON body', error);
    }

    const { name, gradeLevel, teacherId } = body;

    if (!teacherId) {
      throw new ValidationError('teacherId is required');
    }
    if (!name) {
      throw new ValidationError('name is required');
    }
    if (!gradeLevel) {
      throw new ValidationError('gradeLevel is required');
    }

    const teacherExists = await repos.users.exists(teacherId);
    if (!teacherExists) {
      throw new ResourceNotFoundError('User');
    }

    const cls = await repos.classes.create({
      name,
      gradeLevel,
      teacherId,
    });

    return createdResponse(cls, 'Class created successfully');
  });
}
