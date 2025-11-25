import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { classId: classIdParam } = await params;
    const userId = Number(session.user.id);
    const classId = Number(classIdParam);

    if (!classId || !Number.isFinite(classId)) {
      return NextResponse.json({ error: 'Invalid class ID' }, { status: 400 });
    }

    const cls = await prisma.class.findFirst({
      where: {
        id: classId,
        teacherId: userId,
      },
      include: {
        lessons: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    if (!cls) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    return NextResponse.json({ class: cls });
  } catch (error) {
    console.error('Error fetching class:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
