import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { updateLessonStatus } from '@/app/actions/lessons';
import { LessonTabs } from '@/components/lesson-tabs';
import { LessonH5Player } from '@/components/lesson-h5-player';
import { LessonPlanEditor } from '@/components/lesson-plan-editor';
import { LessonH5Editor } from '@/components/lesson-h5-editor';

export const runtime = 'nodejs';

interface LessonPageProps {
  params: Promise<{
    lessonId: string;
  }>;
  searchParams?: Promise<{
    tab?: string;
  }>;
}

export default async function LessonDetailPage({ params, searchParams }: LessonPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const { lessonId } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const id = Number(lessonId);

  if (!id || !Number.isFinite(id)) {
    redirect('/dashboard');
  }

  const lesson = await prisma.lessonCard.findFirst({
    where: {
      id,
      class: {
        teacherId: Number(session.user.id),
      },
    },
    include: {
      class: true,
    },
  });

  if (!lesson) {
    redirect('/dashboard');
  }

  const initialTabFromSearch = sp?.tab;
  let initialTab: 'preview' | 'edit' | 'h5' = 'preview';
  if (initialTabFromSearch === 'edit' || initialTabFromSearch === 'h5') {
    initialTab = initialTabFromSearch;
  }

  const statusLabel =
    lesson.status === 'draft' ? '备课中' : lesson.status === 'ready' ? '待上课' : lesson.status;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{lesson.title}</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              班级：{lesson.class?.name}（{lesson.class?.gradeLevel}） · 课程 ID：{lesson.id}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              状态：
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {statusLabel}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <form action={updateLessonStatus}>
              <input type="hidden" name="lessonId" value={lesson.id} />
              <input
                type="hidden"
                name="status"
                value={lesson.status === 'draft' ? 'ready' : 'draft'}
              />
              <Button type="submit" variant="outline" size="sm">
                {lesson.status === 'draft' ? '标记为待上课' : '改为备课中'}
              </Button>
            </form>
            {lesson.class && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/classes/${lesson.classId}`}>返回班级工作台</Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">返回控制台</Link>
            </Button>
          </div>
        </div>

        <LessonTabs
          initialTab={initialTab}
          preview={
            <Card>
              <CardHeader>
                <CardTitle>教案预览</CardTitle>
                <CardDescription>AI 生成的教案原文（Markdown），仅供阅读。</CardDescription>
              </CardHeader>
              <CardContent>
                {lesson.mdPlan ? (
                  <pre className="max-h-[420px] overflow-auto rounded-md bg-muted p-4 text-xs whitespace-pre-wrap">
                    {lesson.mdPlan}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    当前课程卡片还没有教案内容，可能是 AI 生成失败或尚未生成。
                  </p>
                )}
              </CardContent>
            </Card>
          }
          edit={
            <Card>
              <CardHeader>
                <CardTitle>教案编辑</CardTitle>
                <CardDescription>
                  可以在此修改教案内容。系统仍会以 Markdown
                  形式保存，但你可以通过上方的结构化表单或下方的高级模式来编辑。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LessonPlanEditor lessonId={lesson.id} initialMdPlan={lesson.mdPlan} />
              </CardContent>
            </Card>
          }
          h5={
            <Card>
              <CardHeader>
                <CardTitle>课件展示</CardTitle>
                <CardDescription>
                  点击“开始课件展示”进入类似 PPT 的放映模式，下方可以直接编辑课件幻灯片。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <LessonH5Player h5Json={lesson.h5Json} showPreviewGrid={false} />
                  <LessonH5Editor lessonId={lesson.id} initialH5Json={lesson.h5Json} />
                </div>
              </CardContent>
            </Card>
          }
        />
      </div>
    </div>
  );
}
