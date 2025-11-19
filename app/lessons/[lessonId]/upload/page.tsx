import { H5Uploader } from '@/components/upload/h5-uploader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db/client';
import { notFound } from 'next/navigation';
import { verifyLessonUploadToken } from '@/lib/lesson-upload-token';

export const runtime = 'nodejs';

interface PageProps {
  params: Promise<{
    lessonId: string;
  }>;
  searchParams?: Promise<{
    token?: string;
  }>;
}

export default async function LessonUploadPage({ params, searchParams }: PageProps) {
  const { lessonId } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const id = Number(lessonId);

  if (!id || !Number.isFinite(id)) {
    notFound();
  }

  const lesson = await prisma.lessonCard.findUnique({
    where: { id },
    include: {
      class: true,
    },
  });

  if (!lesson) {
    notFound();
  }

  const token = sp?.token || null;
  const valid = verifyLessonUploadToken(id, token);

  if (!valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow">
          <h1 className="text-lg font-semibold">链接已失效或不正确</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            请在电脑端重新打开课程详情页面的“学生作品”标签，然后使用屏幕上的二维码再次扫码进入。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-primary text-primary-foreground p-6 pb-12">
        <h1 className="mb-2 text-2xl font-bold">{lesson.title}</h1>
        <p className="opacity-90">
          {lesson.class?.gradeLevel} • {lesson.class?.name}
        </p>
      </div>

      <div className="px-4 -mt-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">上传学生作品</CardTitle>
          </CardHeader>
          <CardContent>
            <H5Uploader lessonId={id} uploadToken={token as string} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
