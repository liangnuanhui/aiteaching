import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createLesson } from '@/app/actions/lessons';

export const runtime = 'nodejs';

interface ClassPageProps {
  params: {
    classId: string;
  };
}

export default async function ClassDetailPage({ params }: ClassPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?callbackUrl=/classes');
  }

  const userId = Number(session.user.id);
  const classId = Number(params.classId);

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
            <CardTitle>课程卡片</CardTitle>
            <CardDescription>
              为本班每一节课创建一张课程卡片，后续可绑定作品上传与 AI 分析。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cls.lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                暂无课程卡片，请先在下方填写课题名称，新建一张课程卡片。
              </p>
            ) : (
              <ul className="space-y-2">
                {cls.lessons.map(lesson => (
                  <li
                    key={lesson.id}
                    className="flex flex-col rounded-md border border-border p-3 text-sm"
                  >
                    <span className="font-medium">{lesson.title}</span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      状态：{lesson.status === 'draft' ? '备课中' : lesson.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <form action={createLesson} className="mt-2 space-y-3">
              <input type="hidden" name="classId" value={cls.id} />
              <div className="space-y-2">
                <label htmlFor="lesson-title" className="text-sm font-medium">
                  新建课程卡片
                </label>
                <input
                  id="lesson-title"
                  name="title"
                  type="text"
                  required
                  placeholder="例如：认识分数、春天的校园写作课"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <Button type="submit" className="w-full md:w-auto">
                新建课程卡片
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
