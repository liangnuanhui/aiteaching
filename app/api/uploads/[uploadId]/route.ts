import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { deleteFile } from '@/lib/storage';

export const runtime = 'nodejs';

const prisma = createPrismaClient();

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { uploadId: uploadIdParam } = await params;
    const uploadId = Number(uploadIdParam);
    if (!Number.isFinite(uploadId)) {
      return NextResponse.json({ error: 'Invalid upload id' }, { status: 400 });
    }

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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.upload.delete({ where: { id: uploadId } });

    if (upload.filePath) {
      try {
        await deleteFile(upload.filePath);
      } catch (error) {
        console.error('Failed to delete file from storage:', error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
