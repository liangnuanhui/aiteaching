/**
 * Profile page that surfaces basic account information and placeholder guidance.
 */

import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">个人信息</h1>
          <p className="text-muted-foreground">
            查看并管理当前登录账号的基本信息。后续可以在这里扩展更多设置，例如修改姓名、头像、
            绑定第三方账号等。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>账号信息</CardTitle>
            <CardDescription>当前登录用户的基础资料</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm font-medium">邮箱</span>
              <p className="text-muted-foreground">{session.user.email}</p>
            </div>
            <div>
              <span className="text-sm font-medium">显示姓名</span>
              <p className="text-muted-foreground">{session.user.name || '未设置'}</p>
            </div>
            <div>
              <span className="text-sm font-medium">用户 ID</span>
              <p className="text-muted-foreground">{session.user.id}</p>
            </div>
            <div>
              <span className="text-sm font-medium">头像</span>
              <p className="text-muted-foreground">
                {session.user.image || '暂未上传头像，后续可以在这里接入头像上传功能。'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>下一步可以做什么？</CardTitle>
            <CardDescription>返回控制台继续管理班级和学生，或回到首页。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/dashboard">返回控制台</Link>
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
