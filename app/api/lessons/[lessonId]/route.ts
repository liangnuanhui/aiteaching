import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/client';

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

    const { lessonId: lessonIdParam } = await params;
    const id = Number(lessonIdParam);

    if (!id || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid lesson ID' }, { status: 400 });
    }

    const lesson = await prisma.lessonCard.findFirst({
      where: {
        id,
        class: {
          teacherId: Number(session.user.id),
        },
      },
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

    const hasStudentWorks =
      (await prisma.upload.count({
        where: {
          lessonId: lesson.id,
        },
      })) > 0;

    return NextResponse.json({
      lesson,
      hasStudentWorks,
    });
  } catch (error) {
    console.error('Error fetching lesson:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
