/**
 * Report Page
 * Displays AI-generated analysis report for lesson
 */

'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ReportClient } from './report-client';

interface Lesson {
  id: number;
  title: string;
  class: {
    id: number;
    teacherId: number;
  };
}

interface ReportData {
  lesson: Lesson;
  report: {
    content: string;
  } | null;
  stats: {
    total: number;
    confirmed: number;
    pending: number;
  };
}

interface ReportPageProps {
  params: Promise<{ lessonId: string }>;
}

export default function ReportPage({ params }: ReportPageProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      loadReportData();
    }
  }, [session, params]);

  const loadReportData = async () => {
    try {
      const { lessonId: lessonIdStr } = await params;
      const lessonId = Number(lessonIdStr);

      const response = await fetch(`/api/lessons/${lessonId}/report`);
      if (!response.ok) {
        if (response.status === 404) {
          return;
        }
        if (response.status === 403) {
          return;
        }
        throw new Error('Failed to fetch report data');
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || !session) {
    return <div>加载中...</div>;
  }

  if (loading || !data) {
    return <div>加载中...</div>;
  }

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
