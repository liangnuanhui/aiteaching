/**
 * LessonStudentWorks
 * 课程详情页的“学生作品”Tab 内容：
 * - 显示当前课程的上传二维码（指向 H5 上传页）
 * - 简单展示已上传作品数量和缩略图
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const QR_BASE_URL = process.env.NEXT_PUBLIC_QR_BASE_URL;

interface LessonStudentWorksProps {
  lessonId: number;
  title: string;
  className?: string | null;
  gradeLevel?: string | null;
  uploadToken: string;
}

interface UploadWork {
  id: number;
  url: string;
  originalFilename: string;
  uploadedAt: number;
  fileSize: number;
  contentType?: string | null;
}

export function LessonStudentWorks({
  lessonId,
  title,
  className,
  gradeLevel,
  uploadToken,
}: LessonStudentWorksProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [works, setWorks] = useState<UploadWork[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    // 在客户端根据当前 origin 生成上传页完整 URL
    const path = `/lessons/${lessonId}/upload`;
    const origin =
      typeof window !== 'undefined' ? QR_BASE_URL || window.location.origin : QR_BASE_URL || '';
    const uploadUrl = `${origin}${path}?token=${encodeURIComponent(uploadToken)}`;

    QRCode.toDataURL(uploadUrl, { margin: 1, width: 240 })
      .then(setQrDataUrl)
      .catch(err => {
        console.error('生成二维码失败:', err);
      });
  }, [lessonId, uploadToken]);

  const loadWorks = useCallback(() => {
    setLoading(true);
    fetch(`/api/student-works?lessonId=${lessonId}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then((data: { success: boolean; data: UploadWork[] }) => {
        if (!data?.success) return;
        setWorks(data.data || []);
        setLastUpdatedAt(new Date());
      })
      .catch(err => {
        console.error('加载学生作品失败:', err);
      })
      .finally(() => setLoading(false));
  }, [lessonId]);

  useEffect(() => {
    // 首次加载
    loadWorks();

    // 短时轮询：Tab 打开后的前 2 分钟内每 10 秒刷新一次，避免整夜轮询
    let count = 0;
    const maxPolls = 12; // 12 * 10s = 120s
    const timer = setInterval(() => {
      count += 1;
      loadWorks();
      if (count >= maxPolls) {
        clearInterval(timer);
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [loadWorks]);

  const headerText =
    className || gradeLevel
      ? `${title} - ${className || ''}${gradeLevel ? `（${gradeLevel}）` : ''}`
      : title;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>学生作品上传二维码</CardTitle>
          <CardDescription>
            上完课后，请用手机扫描二维码，打开本课程专属上传页面，对着学生作品逐张拍照并上传。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col items-center gap-2">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="学生作品上传二维码"
                  className="h-48 w-48 rounded-md border bg-white p-2 shadow"
                />
              ) : (
                <div className="flex h-48 w-48 items-center justify-center rounded-md border bg-muted">
                  <span className="text-xs text-muted-foreground">正在生成二维码…</span>
                </div>
              )}
              <div className="text-center text-xs text-muted-foreground">
                当前课程：{headerText}
              </div>
            </div>
            <div className="mt-4 flex-1 text-xs text-muted-foreground md:mt-0 md:pl-6">
              <p>使用说明：</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>在电脑上打开本页面，保持二维码清晰显示。</li>
                <li>用手机扫码，进入上传页面（只需教师手机即可）。</li>
                <li>在上传页面中批量选择学生作品照片，点击“开始上传”。</li>
                <li>上传完成后，可在下方“已上传作品”区域查看缩略图数量。</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>已上传作品</CardTitle>
            <CardDescription>
              当前课程共 {works.length} 个作品{loading ? '（加载中…）' : ''}{' '}
              {lastUpdatedAt && !loading ? `· 最近更新 ${lastUpdatedAt.toLocaleTimeString()}` : ''}
            </CardDescription>
          </div>
          <Button type="button" size="xs" variant="outline" onClick={loadWorks} disabled={loading}>
            刷新列表
          </Button>
        </CardHeader>
        <CardContent>
          {works.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">暂时还没有上传的学生作品。</p>
          )}
          {works.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {works.map(work => (
                <div key={work.id} className="overflow-hidden rounded-md border bg-muted/40">
                  <div className="h-28 w-full bg-background">
                    {work.url ? (
                      <Image
                        src={work.url}
                        alt={work.originalFilename}
                        width={160}
                        height={112}
                        className="h-28 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        文件
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-1">
                    <div className="truncate text-xs text-foreground">{work.originalFilename}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
