/**
 * API Route: Get pending uploads for archiving
 * GET /api/lessons/[lessonId]/pending-uploads
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { TriageService } from '@/lib/upload/triage-service';

const prisma = createPrismaClient();
const triageService = new TriageService(prisma);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lessonId: lessonIdStr } = await params;
    const lessonId = Number(lessonIdStr);

    if (isNaN(lessonId)) {
      return NextResponse.json({ error: 'Invalid lesson ID' }, { status: 400 });
    }

    // 2. Verify permission
    const lesson = await prisma.lessonCard.findUnique({
      where: { id: lessonId },
      include: {
        class: true,
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    if (lesson.class.teacherId !== Number(session.user.id)) {
      return NextResponse.json(
        { error: 'Permission denied: not the teacher of this class' },
        { status: 403 }
      );
    }

    // 3. Get uploads grouped by status
    const uploads = await prisma.upload.findMany({
      where: {
        lessonId,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
        suggestedStudent: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
      },
      orderBy: {
        uploadedAt: 'asc',
      },
    });

    // 4. Get students in the class
    const students = await prisma.student.findMany({
      where: {
        classId: lesson.classId,
      },
      select: {
        id: true,
        name: true,
        nickname: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // 5. Get triage statistics
    const stats = await triageService.getTriageStats(lessonId);

    // 6. Group uploads by status
    const grouped = {
      autoMatched: uploads.filter(u => u.triageStatus === 'auto_matched'),
      pendingConfirmation: uploads.filter(u => u.triageStatus === 'pending_confirmation'),
      pendingManual: uploads.filter(u => u.triageStatus === 'pending_manual'),
      confirmed: uploads.filter(u => u.triageStatus === 'confirmed'),
      pending: uploads.filter(u => u.triageStatus === 'pending'),
      processing: uploads.filter(u => u.triageStatus === 'processing'),
      failed: uploads.filter(u => u.triageStatus === 'failed'),
    };

    return NextResponse.json({
      uploads: grouped,
      students,
      stats,
    });
  } catch (error) {
    console.error('Failed to get pending uploads:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
