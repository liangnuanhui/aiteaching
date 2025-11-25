'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AddStudentForm } from '@/components/add-student-form';
import { DeleteStudentButton } from '@/components/delete-student-button';
import { StudentNicknameEditor } from '@/components/student-nickname-editor';

interface Student {
  id: number;
  name: string;
  nickname: string | null;
  createdAt: number;
}

interface ClassData {
  id: number;
  name: string;
  gradeLevel: string;
  students: Student[];
}

interface ClassStudentsPageProps {
  params: Promise<{
    classId: string;
  }>;
}

export default function ClassStudentsPage({ params }: ClassStudentsPageProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cls, setCls] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/classes');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      loadClassData();
    }
  }, [session, params]);

  const loadClassData = async () => {
    try {
      const { classId: classIdParam } = await params;
      const currentClassId = Number(classIdParam);

      if (!currentClassId || !Number.isFinite(currentClassId)) {
        router.push('/classes');
        return;
      }

      setClassId(currentClassId);

      const response = await fetch(`/api/classes/${currentClassId}/students`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/classes');
          return;
        }
        throw new Error('Failed to fetch class data');
      }

      const data = await response.json();
      setCls(data.class);
    } catch (error) {
      console.error('Error loading class data:', error);
      router.push('/classes');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || !session) {
    return <div>加载中...</div>;
  }

  if (loading || !cls || !classId) {
    return <div>加载中...</div>;
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
              <Link href={`/classes/${cls.id}`}>返回班级工作台</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/classes">班级列表</Link>
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
      </div>
    </div>
  );
}
