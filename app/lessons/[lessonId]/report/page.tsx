/**
 * Report Page
 * Displays AI-generated analysis report for lesson
 */

import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { redirect } from 'next/navigation';
import { ReportClient } from './report-client';

const prisma = createPrismaClient();

export default async function ReportPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const { lessonId: lessonIdStr } = await params;
  const lessonId = Number(lessonIdStr);

  // Get lesson info
  const lesson = await prisma.lessonCard.findUnique({
    where: { id: lessonId },
    include: {
      class: true,
    },
  });

  if (!lesson) {
    return <div className="p-8">课程不存在</div>;
  }

  if (lesson.class.teacherId !== Number(session.user.id)) {
    return <div className="p-8">无权限访问</div>;
  }

  // Get existing report
  const report = await prisma.report.findFirst({
    where: {
      lessonId,
      reportType: 'class',
    },
  });

  // Get upload stats
  const uploads = await prisma.upload.findMany({
    where: {
      lessonId,
    },
    select: {
      triageStatus: true,
    },
  });

  const stats = {
    total: uploads.length,
    confirmed: uploads.filter(u => u.triageStatus === 'confirmed').length,
    pending: uploads.filter(u => u.triageStatus !== 'confirmed' && u.triageStatus !== 'failed')
      .length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">学生作品分析报告</h1>
          <p className="text-gray-600">{lesson.title}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-gray-600">总作品数</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-700">{stats.confirmed}</div>
            <div className="text-sm text-gray-600">已归档</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
            <div className="text-sm text-gray-600">待归档</div>
          </div>
        </div>

        {/* Report Content */}
        <ReportClient
          lessonId={lessonId}
          initialReport={report?.content || null}
          canGenerate={stats.confirmed > 0}
        />
      </div>
    </div>
  );
}
