/**
 * API Route: Generate and retrieve analysis report
 * POST /api/lessons/[lessonId]/report - Generate new report
 * GET /api/lessons/[lessonId]/report - Get existing report
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { ReportGenerator } from '@/lib/analysis/report-generator';

// Use Node.js runtime for Prisma support
export const runtime = 'nodejs';

const prisma = createPrismaClient();
const reportGenerator = new ReportGenerator(prisma);

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

    // 3. Get existing report
    const report = await reportGenerator.getReport(lessonId);

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ content: report });
  } catch (error) {
    console.error('Failed to get report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
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

    // 3. Generate report
    const content = await reportGenerator.generateClassReport(lessonId);

    // 4. Save report
    await reportGenerator.saveReport(lessonId, content);

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Failed to generate report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
