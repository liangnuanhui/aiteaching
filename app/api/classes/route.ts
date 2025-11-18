import { NextRequest } from 'next/server';
import { createdResponse, successResponse, withRepositories } from '@/lib/api';
import { ValidationError, ResourceNotFoundError } from '@/lib/errors';

export const runtime = 'nodejs';

// GET /api/classes - list classes (optionally by teacherId)
export async function GET(request: NextRequest) {
  return withRepositories(request, async repos => {
    const searchParams = request.nextUrl.searchParams;
    const teacherIdParam = searchParams.get('teacherId');

    const teacherId = teacherIdParam ? parseInt(teacherIdParam, 10) : undefined;

    const classes = await repos.classes.findAll({ teacherId });

    return successResponse(classes, 'Classes retrieved successfully');
  });
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
