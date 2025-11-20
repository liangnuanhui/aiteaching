/**
 * Archive Page
 * Main page for archiving student works with three-state triage
 */

import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { storage } from '@/lib/storage';
import { redirect } from 'next/navigation';
import { ArchiveClient } from './archive-client';

// Use Node.js runtime for Prisma support
export const runtime = 'nodejs';

const prisma = createPrismaClient();

export default async function ArchivePage({ params }: { params: Promise<{ lessonId: string }> }) {
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
    return <div className="p-8">课程不存在</div>;
  }

  if (lesson.class.teacherId !== Number(session.user.id)) {
    return <div className="p-8">无权限访问</div>;
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">学生作品归档</h1>
          <p className="text-gray-600">{lesson.title}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-gray-600">总作品数</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-700">{stats.confirmed}</div>
            <div className="text-sm text-gray-600">已归档</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-yellow-700">
              {stats.autoMatched + stats.pendingConfirmation + stats.pendingManual}
            </div>
            <div className="text-sm text-gray-600">待归档</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-700">
              {stats.pending + stats.processing}
            </div>
            <div className="text-sm text-gray-600">处理中</div>
          </div>
        </div>

        {/* Processing Notice */}
        {(stats.pending > 0 || stats.processing > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
              <div>
                <div className="font-medium text-blue-900">
                  正在处理 {stats.pending + stats.processing} 张照片...
                </div>
                <div className="text-sm text-blue-700">
                  OCR识别和智能分流正在后台进行，请稍候刷新页面查看结果
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Failed Notice */}
        {stats.failed > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <div className="font-medium text-red-900">{stats.failed} 张照片处理失败</div>
            <div className="text-sm text-red-700">请检查文件格式或手动归档</div>
          </div>
        )}

        {/* Client Component with all the interactive sections */}
        <ArchiveClient lessonId={lessonId} uploads={grouped} students={lesson.class.students} />
      </div>
    </div>
  );
}
