import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { storage } from '@/lib/storage';
import { verifyLessonUploadToken } from '@/lib/lesson-upload-token';
import { AuthenticationError, MissingRequiredFieldError, ValidationError } from '@/lib/errors';

export const runtime = 'nodejs';

/**
 * POST /api/student-works
 * 保存学生作品记录
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const lessonIdValue = formData.get('lessonId');
    const worksJson = formData.get('works');
    const tokenValue = formData.get('token');

    if (!lessonIdValue) {
      throw new MissingRequiredFieldError('lessonId');
    }
    if (!worksJson) {
      throw new MissingRequiredFieldError('works');
    }
    if (!tokenValue) {
      throw new MissingRequiredFieldError('token');
    }

    const lessonId = Number(lessonIdValue);
    if (!lessonId || !Number.isFinite(lessonId)) {
      throw new ValidationError('lessonId is invalid');
    }

    const token = tokenValue.toString();
    const valid = verifyLessonUploadToken(lessonId, token);
    if (!valid) {
      throw new AuthenticationError('无权限操作此课程');
    }

    let works: unknown;
    try {
      works = JSON.parse(worksJson.toString());
    } catch (error) {
      throw new ValidationError('works must be valid JSON', error);
    }

    if (!Array.isArray(works)) {
      throw new ValidationError('works must be an array');
    }

    const prisma = createPrismaClient();

    const now = Math.floor(Date.now() / 1000);

    // 将上传结果映射到 Upload 模型
    const created = await Promise.all(
      (
        works as {
          key?: string;
          url?: string;
          name?: string;
          size?: number;
          contentType?: string;
        }[]
      ).map(work =>
        prisma.upload.create({
          data: {
            lessonId,
            filePath: work.key || '',
            fileHash: '',
            fileSize: work.size || 0,
            originalFilename: work.name || work.key || '',
            uploadedAt: now,
            // 其余字段使用默认值（ocrStatus、triageStatus 等）
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      count: created.length,
      data: created,
    });
  } catch (error) {
    console.error('保存学生作品失败:', error);

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof MissingRequiredFieldError || error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/student-works?lessonId=xxx
 * 获取某个课程的所有学生作品
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AuthenticationError('请先登录');
    }

    const userId = Number(session.user.id);
    const searchParams = request.nextUrl.searchParams;
    const lessonId = Number(searchParams.get('lessonId') || '');

    if (!lessonId || !Number.isFinite(lessonId)) {
      throw new ValidationError('lessonId is required and must be a number');
    }

    const prisma = createPrismaClient();

    const lesson = await prisma.lessonCard.findFirst({
      where: {
        id: lessonId,
        class: {
          teacherId: userId,
        },
      },
    });

    if (!lesson) {
      throw new AuthenticationError('无权限查看此课程');
    }

    const works = await prisma.upload.findMany({
      where: {
        lessonId,
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    const data = works.map(work => ({
      ...work,
      url: storage ? storage.getUrl(work.filePath) : '',
    }));

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('获取学生作品失败:', error);

    if (error instanceof AuthenticationError || error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
