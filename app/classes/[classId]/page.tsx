import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AddStudentForm } from '@/components/add-student-form';
import { DeleteStudentButton } from '@/components/delete-student-button';
import { StudentNicknameEditor } from '@/components/student-nickname-editor';
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
      students: {
        orderBy: { createdAt: 'asc' },
      },
      lessons: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!cls) {
    redirect('/classes');
  }

  const nameCounts = cls.students.reduce<Record<string, number>>((acc, student) => {
    acc[student.name] = (acc[student.name] ?? 0) + 1;
    return acc;
  }, {});

  const duplicatedNames = Object.entries(nameCounts)
    .filter(([, count]) => count > 1)
    .map(([name]) => name);

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

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>学生列表</CardTitle>
              <CardDescription>本班共有 {cls.students.length} 名学生</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {cls.students.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无学生，请在右侧表单中添加学生。</p>
              ) : (
                <>
                  {duplicatedNames.length > 0 && (
                    <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                      提示：本班存在同名学生（
                      {duplicatedNames.join('、')}
                      ），建议为他们设置「备注名」以方便区分，例如「大张三、小张三」。
                    </div>
                  )}
                  <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {cls.students.map((student, index) => (
                      <li
                        key={student.id}
                        className="flex flex-col rounded-md border border-border p-3"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground mb-1">
                            第 {index + 1} 位学生
                          </span>
                          <span className="font-medium">{student.name}</span>
                          <StudentNicknameEditor
                            classId={cls.id}
                            studentId={student.id}
                            nickname={student.nickname}
                            hasDuplicateName={nameCounts[student.name] > 1}
                          />
                        </div>
                        <div className="mt-2 flex justify-end">
                          <DeleteStudentButton classId={cls.id} studentId={student.id} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>添加学生</CardTitle>
              <CardDescription>为本班添加学生，备注名可帮助区分重名学生。</CardDescription>
            </CardHeader>
            <CardContent>
              <AddStudentForm classId={cls.id} existingNames={cls.students.map(s => s.name)} />
            </CardContent>
          </Card>
        </div>

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
