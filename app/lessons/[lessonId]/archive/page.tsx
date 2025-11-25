/**
 * Archive Page
 * Main page for archiving student works with three-state triage
 */

'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArchiveClient } from './archive-client';

interface Student {
  id: number;
  name: string;
  nickname: string | null;
}

interface Lesson {
  id: number;
  title: string;
  class: {
    id: number;
    teacherId: number;
    students: Student[];
  };
}

interface Upload {
  id: number;
  filePath: string;
  triageStatus: string;
  uploadedAt: string;
  student: Student | null;
  suggestedStudent: Student | null;
  previewUrl: string;
}

interface GroupedUploads {
  autoMatched: Upload[];
  pendingConfirmation: Upload[];
  pendingManual: Upload[];
  confirmed: Upload[];
  pending: Upload[];
  processing: Upload[];
  failed: Upload[];
}

interface ArchivePageProps {
  params: Promise<{ lessonId: string }>;
}

export default function ArchivePage({ params }: ArchivePageProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [grouped, setGrouped] = useState<GroupedUploads | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      loadArchiveData();
    }
  }, [session, params]);

  const loadArchiveData = async () => {
    try {
      const { lessonId: lessonIdStr } = await params;
      const lessonId = Number(lessonIdStr);

      const response = await fetch(`/api/lessons/${lessonId}/archive`);
      if (!response.ok) {
        if (response.status === 404) {
          return;
        }
        if (response.status === 403) {
          return;
        }
        throw new Error('Failed to fetch archive data');
      }

      const data = await response.json();
      setLesson(data.lesson);
      setGrouped(data.grouped);
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading archive data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || !session) {
    return <div>加载中...</div>;
  }

  if (loading || !lesson || !grouped || !stats) {
    return <div>加载中...</div>;
  }

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
