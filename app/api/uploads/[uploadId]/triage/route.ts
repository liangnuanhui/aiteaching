/**
 * API Route: Update upload triage status
 * PATCH /api/uploads/[uploadId]/triage
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { TriageService } from '@/lib/upload/triage-service';

// Use Node.js runtime for Prisma support
export const runtime = 'nodejs';

const prisma = createPrismaClient();
const triageService = new TriageService(prisma);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { uploadId: uploadIdStr } = await params;
    const uploadId = Number(uploadIdStr);

    if (isNaN(uploadId)) {
      return NextResponse.json({ error: 'Invalid upload ID' }, { status: 400 });
    }

    // 2. Parse request body
    const body = (await request.json()) as {
      status?: string;
      studentId?: number;
    };
    const { status, studentId } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    // 3. Verify permission
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      include: {
        lesson: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    if (upload.lesson.class.teacherId !== Number(session.user.id)) {
      return NextResponse.json(
        { error: 'Permission denied: not the teacher of this class' },
        { status: 403 }
      );
    }

    // 4. Update upload
    if (studentId) {
      // Confirm with specific student
      await triageService.confirmUpload(uploadId, Number(studentId), Number(session.user.id));
    } else if (status === 'confirmed') {
      // Confirm auto_matched upload
      const now = Math.floor(Date.now() / 1000);
      await prisma.upload.update({
        where: { id: uploadId },
        data: {
          triageStatus: 'confirmed',
          archivedAt: now,
        },
      });
    } else {
      // Update status only
      await prisma.upload.update({
        where: { id: uploadId },
        data: {
          triageStatus: status,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update upload triage:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
