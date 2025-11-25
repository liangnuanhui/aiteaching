import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { tableExists } from '@/lib/db/utils';

// CRITICAL: Add this line for database access
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teacherId = Number(session.user.id);

    const [classes, lessons, reportTableExists] = await Promise.all([
      prisma.class.findMany({
        where: { teacherId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.lessonCard.findMany({
        where: {
          class: {
            teacherId,
          },
        },
        include: {
          class: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      tableExists(prisma, 'reports'),
    ]);

    const lessonIds = lessons.map(lesson => lesson.id);

    type CountRow = { lessonId: number; count: number };

    let uploadCounts: CountRow[] = [];
    if (lessonIds.length) {
      uploadCounts = await prisma.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT lesson_id as lessonId, COUNT(*) as count FROM uploads WHERE lesson_id IN (${Prisma.join(
          lessonIds
        )}) GROUP BY lesson_id`
      );
    }

    let reportCounts: CountRow[] = [];
    if (reportTableExists && lessonIds.length) {
      try {
        reportCounts = await prisma.$queryRaw<CountRow[]>(
          Prisma.sql`SELECT lesson_id as lessonId, COUNT(*) as count FROM reports WHERE lesson_id IN (${Prisma.join(
            lessonIds
          )}) GROUP BY lesson_id`
        );
      } catch (error) {
        console.warn('Failed to load report counts:', error);
      }
    }

    const uploadCountMap = new Map<number, number>(
      uploadCounts.map(item => [item.lessonId, Number(item.count)])
    );
    const reportCountMap = new Map<number, number>(
      reportCounts.map(item => [item.lessonId, Number(item.count)])
    );

    // Convert maps to records for JSON serialization
    const uploadCountsRecord: Record<number, number> = {};
    const reportCountsRecord: Record<number, number> = {};

    uploadCountMap.forEach((count, lessonId) => {
      uploadCountsRecord[lessonId] = count;
    });

    reportCountMap.forEach((count, lessonId) => {
      reportCountsRecord[lessonId] = count;
    });

    return NextResponse.json({
      classes,
      lessons,
      uploadCounts: uploadCountsRecord,
      reportCounts: reportCountsRecord,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
