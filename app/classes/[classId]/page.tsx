import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateLessonDialog } from '@/components/create-lesson-dialog';

export const runtime = 'nodejs';

interface ClassPageProps {
  params: Promise<{
    classId: string;
  }>;
}

export default async function ClassDetailPage({ params }: ClassPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?callbackUrl=/classes');
  }

  const { classId: classIdParam } = await params;
  const userId = Number(session.user.id);
  const classId = Number(classIdParam);

  if (!classId || !Number.isFinite(classId)) {
    redirect('/classes');
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
    redirect('/classes');
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{cls.name}</h1>
            <p className="text-muted-foreground mt-2">
              年级：{cls.gradeLevel} · 班级 ID：{cls.id}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/classes">返回班级列表</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">控制台</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>班级概览</CardTitle>
            <CardDescription>查看本班学生数量和课程卡片概况。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                学生人数：
                <span className="font-medium text-foreground">{cls._count.students}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                课程卡片数量：
                <span className="font-medium text-foreground">{cls.lessons.length}</span>
              </p>
            </div>
            <Button asChild>
              <Link href={`/classes/${cls.id}/students`}>学生管理</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>课程卡片</CardTitle>
                <CardDescription>
                  为本班每一节课创建一张课程卡片，后续可绑定作品上传与 AI 分析。
                </CardDescription>
              </div>
              <CreateLessonDialog
                classes={[
                  {
                    id: cls.id,
                    name: cls.name,
                    gradeLevel: cls.gradeLevel,
                  },
                ]}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {cls.lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                暂无课程卡片，请直接点击上方“使用 AI 创建新课程”按钮快速生成。
              </p>
            ) : (
              <ul className="space-y-2">
                {cls.lessons.map(lesson => (
                  <li
                    key={lesson.id}
                    className="flex flex-col rounded-md border border-border p-3 text-sm"
                  >
                    <span className="font-medium">
                      <Link
                        href={`/lessons/${lesson.id}`}
                        className="hover:underline underline-offset-2"
                      >
                        {lesson.title}
                      </Link>
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      状态：{lesson.status === 'draft' ? '备课中' : lesson.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-xs text-muted-foreground">
              小贴士：你当前正位于 {cls.name}，通过“使用 AI
              创建新课程”按钮即可生成只属于该班的课程卡片。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
