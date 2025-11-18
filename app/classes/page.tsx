import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { createClass } from '@/app/actions/classes';

export const runtime = 'nodejs';

export default async function ClassesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?callbackUrl=/classes');
  }

  const teacherId = Number(session.user.id);

  const classes = await prisma.class.findMany({
    where: { teacherId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">班级管理</h1>
            <p className="text-muted-foreground mt-2">
              为自己带的班级建立档案，是 AI 教案与作品管理的起点。
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard">返回控制台</Link>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Your Classes</CardTitle>
              <CardDescription>Classes associated with your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {classes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  你还没有创建任何班级，请在右侧表单中新建一个班级。
                </p>
              ) : (
                <ul className="space-y-3">
                  {classes.map(cls => (
                    <li key={cls.id} className="flex flex-col rounded-md border border-border p-3">
                      <Link
                        href={`/classes/${cls.id}`}
                        className="font-medium hover:underline underline-offset-2"
                      >
                        {cls.name}
                      </Link>
                      <span className="text-xs text-muted-foreground mt-1">
                        年级：{cls.gradeLevel}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>新建班级</CardTitle>
              <CardDescription>为你当前带的班级建立一条记录。</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createClass} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">班级名称</Label>
                  <Input id="name" name="name" placeholder="例如：二年级 1 班" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gradeLevel">学段与年级</Label>
                  <select
                    id="gradeLevel"
                    name="gradeLevel"
                    defaultValue=""
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  >
                    <option value="" disabled>
                      请选择学段与年级
                    </option>
                    <option value="小学一年级">小学一年级</option>
                    <option value="小学二年级">小学二年级</option>
                    <option value="小学三年级">小学三年级</option>
                    <option value="小学四年级">小学四年级</option>
                    <option value="小学五年级">小学五年级</option>
                    <option value="小学六年级">小学六年级</option>
                    <option value="初中一年级">初中一年级</option>
                    <option value="初中二年级">初中二年级</option>
                    <option value="初中三年级">初中三年级</option>
                  </select>
                </div>
                <Button type="submit" className="w-full">
                  创建班级
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
