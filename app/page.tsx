'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { handleSignOut } from '@/app/actions/auth';
import { Suspense } from 'react';
import { HealthStatusCard } from '@/components/health-status-card';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading' || !session) {
    return <div>加载中...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col p-8">
      {/* Top Navigation Bar */}
      <nav className="flex justify-between items-center max-w-6xl mx-auto w-full mb-12">
        <h1 className="text-xl font-bold">心灵微光 · AI 助教工作台</h1>
        <div className="flex items-center gap-4">
          {session?.user ? (
            <>
              <span className="text-sm text-muted-foreground">{session.user.email}</span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard">进入控制台</Link>
              </Button>
              <form action={handleSignOut}>
                <Button type="submit" variant="ghost" size="sm">
                  退出登录
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">登录</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">注册</Link>
              </Button>
            </>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto space-y-8 flex-1 flex flex-col justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">帮助乡村教师，轻松用好 AI</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            一站式「班级管理 + 作品上传 + AI 教案与分析」工作台，面向乡村中小学一线老师。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">班级与学生管理</h2>
            <p className="text-gray-600 dark:text-gray-400">为每个班级、每位学生建立清晰档案。</p>
          </div>

          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">作品上传与归档</h2>
            <p className="text-gray-600 dark:text-gray-400">
              手机扫码拍照上传，自动识别学生并归档作品。
            </p>
          </div>

          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">AI 教案与内容生成</h2>
            <p className="text-gray-600 dark:text-gray-400">
              根据年级与主题，一键生成可直接使用的课堂教案。
            </p>
          </div>

          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">安全稳定的云端存储</h2>
            <p className="text-gray-600 dark:text-gray-400">
              所有数据云端保存，换电脑也能随时继续使用。
            </p>
          </div>
        </div>

        <div className="text-center mt-8 space-y-3">
          <Suspense
            fallback={<div className="text-sm text-muted-foreground">正在检测系统健康状况…</div>}
          >
            <HealthStatusCard />
          </Suspense>
          <div className="space-x-3">
            <a
              href="/upload"
              className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              试一试上传文件
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center items-center gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-primary hover:underline transition">
              隐私政策
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-primary hover:underline transition">
              使用条款
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            © {new Date().getFullYear()} 心灵微光 AI 助教工作台
          </p>
        </div>
      </footer>
    </div>
  );
}
