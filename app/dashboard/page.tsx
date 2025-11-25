'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { handleSignOut } from '@/app/actions/auth';
import { CreateLessonDialog } from '@/components/create-lesson-dialog';
import { DeleteLessonButton } from '@/components/delete-lesson-button';

interface Class {
  id: number;
  name: string;
  gradeLevel: string;
}

interface Lesson {
  id: number;
  title: string;
  status: string;
  createdAt: number;
  classId: number;
  class: {
    id: number;
    name: string;
    gradeLevel: string;
  };
}

interface DashboardData {
  classes: Class[];
  lessons: Lesson[];
  uploadCounts: Record<number, number>;
  reportCounts: Record<number, number>;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchDashboardData();
    }
  }, [session]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">控制台</h1>
            <p className="text-muted-foreground mt-2">
              欢迎回来，{session.user.name || session.user.email}！
            </p>
            <CreateLessonDialog classes={data.classes} />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-xs text-muted-foreground md:block">
              班级：
              <span className="font-medium text-foreground">{data.classes.length}</span> 个 ·
              课程卡片：
              <span className="font-medium text-foreground">{data.lessons.length}</span> 张
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/classes">班级管理</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/profile">账号信息</Link>
              </Button>
              <form action={handleSignOut}>
                <Button type="submit" variant="outline" size="sm">
                  退出登录
                </Button>
              </form>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>我的课程</CardTitle>
            <CardDescription>查看和管理当前账号下所有课程卡片。</CardDescription>
          </CardHeader>
          <CardContent>
            {data.lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                目前还没有任何课程卡片，可以通过上方的「快速新建课程」创建第一节课。
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.lessons.map(lesson => (
                  <Card key={lesson.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold">
                          <Link
                            href={`/lessons/${lesson.id}`}
                            className="hover:underline underline-offset-2"
                          >
                            {lesson.title}
                          </Link>
                        </CardTitle>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          {lesson.status === 'draft' ? '备课中' : lesson.status}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1 text-xs text-muted-foreground">
                      <div>
                        班级：{lesson.class?.name}（{lesson.class?.gradeLevel}）
                      </div>
                      <div>
                        创建时间：
                        {new Date(lesson.createdAt * 1000).toLocaleString('zh-CN', {
                          hour12: false,
                        })}
                      </div>
                      <div>
                        <Link
                          href={`/lessons/${lesson.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          查看/编辑教案
                        </Link>
                        <span className="mx-1 text-muted-foreground">·</span>
                        <DeleteLessonButton
                          lessonId={lesson.id}
                          uploadsCount={data.uploadCounts[lesson.id] ?? 0}
                          reportsCount={data.reportCounts[lesson.id] ?? 0}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
