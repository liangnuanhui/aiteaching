/**
 * Protected Example Page - Dashboard
 * Only accessible to logged-in users
 */

import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { handleSignOut } from '@/app/actions/auth';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">控制台</h1>
            <p className="text-muted-foreground mt-2">
              欢迎回来，{session.user.name || session.user.email}！
            </p>
          </div>
          <form action={handleSignOut}>
            <Button type="submit" variant="outline">
              退出登录
            </Button>
          </form>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>账号信息</CardTitle>
              <CardDescription>当前登录账号</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm font-medium">邮箱：</span>
                <p className="text-muted-foreground">{session.user.email}</p>
              </div>
              <div>
                <span className="text-sm font-medium">姓名：</span>
                <p className="text-muted-foreground">{session.user.name || '未设置'}</p>
              </div>
              <div>
                <span className="text-sm font-medium">用户 ID：</span>
                <p className="text-muted-foreground">{session.user.id}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>快捷入口</CardTitle>
              <CardDescription>常用功能</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/profile">编辑个人信息</Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/classes">管理班级与学生</Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/">返回首页</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>会话信息（调试用）</CardTitle>
            <CardDescription>当前登录会话的详细数据，仅供技术调试</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
              {JSON.stringify(session, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
