import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { createStudent } from '@/app/actions/students';

export const runtime = 'edge';

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
        orderBy: { name: 'asc' },
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
              Grade level: {cls.gradeLevel} · Class ID: {cls.id}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/classes">Back to Classes</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Students</CardTitle>
              <CardDescription>Students in this class</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {cls.students.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No students yet. Use the form on the right to add students.
                </p>
              ) : (
                <ul className="space-y-2">
                  {cls.students.map(student => (
                    <li
                      key={student.id}
                      className="flex flex-col rounded-md border border-border p-3"
                    >
                      <span className="font-medium">{student.name}</span>
                      {student.nickname ? (
                        <span className="text-xs text-muted-foreground mt-1">
                          Nickname: {student.nickname}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Student</CardTitle>
              <CardDescription>
                Add students to this class. Nickname is optional and can help distinguish students
                with the same name.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createStudent} className="space-y-4">
                <input type="hidden" name="classId" value={cls.id} />
                <div className="space-y-2">
                  <Label htmlFor="name">Student name</Label>
                  <Input id="name" name="name" placeholder="e.g. 张三" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nickname">Nickname (optional)</Label>
                  <Input id="nickname" name="nickname" placeholder="e.g. 大张三" />
                </div>
                <Button type="submit" className="w-full">
                  Add Student
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
