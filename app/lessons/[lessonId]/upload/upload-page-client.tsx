'use client';

import { H5Uploader } from '@/components/upload/h5-uploader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UploadPageClientProps {
  lessonId: number;
  uploadToken: string;
  lessonTitle: string;
  classInfo: string;
}

/**
 * Client-only upload page component
 * 纯客户端渲染，避免微信浏览器中的 hydration 错误
 */
export function UploadPageClient({
  lessonId,
  uploadToken,
  lessonTitle,
  classInfo,
}: UploadPageClientProps) {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-primary text-primary-foreground p-6 pb-12">
        <h1 className="mb-2 text-2xl font-bold">{lessonTitle}</h1>
        <p className="opacity-90">{classInfo}</p>
      </div>

      <div className="px-4 -mt-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">上传学生作品</CardTitle>
          </CardHeader>
          <CardContent>
            <H5Uploader lessonId={lessonId} uploadToken={uploadToken} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
