import type { Metadata } from 'next';
import './globals.css';

// CRITICAL: Force Node.js runtime - Prisma and NextAuth are not compatible with Edge Runtime
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: '心灵微光 AI 助教工作台',
  description: '面向乡村中小学教师的 AI 助教与班级管理工作台',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
