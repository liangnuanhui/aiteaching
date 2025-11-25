import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/client';
import { storage } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lessonId: lessonIdStr } = await params;
    const lessonId = Number(lessonIdStr);

    // Get lesson info
    const lesson = await prisma.lessonCard.findUnique({
      where: { id: lessonId },
      include: {
        class: {
          include: {
            students: {
              select: {
                id: true,
                name: true,
                nickname: true,
              },
              orderBy: {
                name: 'asc',
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    if (lesson.class.teacherId !== Number(session.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get uploads grouped by status
    const rawUploads = await prisma.upload.findMany({
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

    const uploads = rawUploads.map(upload => ({
      ...upload,
      previewUrl: storage ? storage.getUrl(upload.filePath) : '',
    }));

    // Group by status
    const grouped = {
      autoMatched: uploads.filter(u => u.triageStatus === 'auto_matched'),
      pendingConfirmation: uploads.filter(u => u.triageStatus === 'pending_confirmation'),
      pendingManual: uploads.filter(u => u.triageStatus === 'pending_manual'),
      confirmed: uploads.filter(u => u.triageStatus === 'confirmed'),
      pending: uploads.filter(u => u.triageStatus === 'pending'),
      processing: uploads.filter(u => u.triageStatus === 'processing'),
      failed: uploads.filter(u => u.triageStatus === 'failed'),
    };

    const stats = {
      total: uploads.length,
      autoMatched: grouped.autoMatched.length,
      pendingConfirmation: grouped.pendingConfirmation.length,
      pendingManual: grouped.pendingManual.length,
      confirmed: grouped.confirmed.length,
      pending: grouped.pending.length,
      processing: grouped.processing.length,
      failed: grouped.failed.length,
    };

    return NextResponse.json({
      lesson,
      grouped,
      stats,
    });
  } catch (error) {
    console.error('Error fetching archive data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
