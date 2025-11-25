import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { storage } from '@/lib/storage';
import { verifyLessonUploadToken } from '@/lib/lesson-upload-token';
import { AuthenticationError, MissingRequiredFieldError, ValidationError } from '@/lib/errors';

export const runtime = 'nodejs';

interface IncomingWorkPayload {
  key?: string;
  url?: string;
  name?: string;
  size?: number;
  contentType?: string;
  hash?: string;
}

interface NormalizedWorkPayload {
  key: string;
  name: string;
  size: number;
  contentType?: string;
  fileHash: string | null;
}

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

    const normalizedWorks: NormalizedWorkPayload[] = [];
    const seenHashes = new Set<string>();
    const skippedInBatch: string[] = [];

    for (const item of works as IncomingWorkPayload[]) {
      if (!item || typeof item !== 'object') continue;
      const key = typeof item.key === 'string' ? item.key : '';
      if (!key) continue;

      const name = typeof item.name === 'string' && item.name.trim().length > 0 ? item.name : key;
      const size = typeof item.size === 'number' && Number.isFinite(item.size) ? item.size : 0;
      const contentType =
        typeof item.contentType === 'string' && item.contentType.length > 0
          ? item.contentType
          : undefined;
      const fileHash =
        typeof item.hash === 'string' && item.hash.trim().length > 0 ? item.hash : null;

      if (fileHash) {
        if (seenHashes.has(fileHash)) {
          skippedInBatch.push(name);
          continue;
        }
        seenHashes.add(fileHash);
      }

      normalizedWorks.push({
        key,
        name,
        size,
        contentType,
        fileHash,
      });
    }

    const hashesToCheck = Array.from(seenHashes);
    let existingHashes = new Set<string>();

    if (hashesToCheck.length > 0) {
      const existing = await prisma.upload.findMany({
        where: {
          lessonId,
          fileHash: {
            in: hashesToCheck,
          },
        },
        select: {
          fileHash: true,
        },
      });
      existingHashes = new Set(existing.map(record => record.fileHash).filter(Boolean));
    }

    const skippedDuplicates = [...skippedInBatch];
    const worksToCreate = normalizedWorks.filter(work => {
      if (work.fileHash && existingHashes.has(work.fileHash)) {
        skippedDuplicates.push(work.name);
        return false;
      }
      if (work.fileHash) {
        existingHashes.add(work.fileHash);
      }
      return true;
    });

    const now = Math.floor(Date.now() / 1000);

    const created = await Promise.all(
      worksToCreate.map(work =>
        prisma.upload.create({
          data: {
            lessonId,
            filePath: work.key,
            fileHash: work.fileHash || '',
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
      skippedDuplicates,
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
    const searchParams = request.nextUrl.searchParams;
    const lessonId = Number(searchParams.get('lessonId') || '');
    const token = searchParams.get('token');

    if (!lessonId || !Number.isFinite(lessonId)) {
      throw new ValidationError('lessonId is required and must be a number');
    }

    const prisma = createPrismaClient();

    if (token) {
      // H5 上传页通过 token 访问，仅检查课程存在性
      const valid = verifyLessonUploadToken(lessonId, token);
      if (!valid) {
        throw new AuthenticationError('无权限查看此课程');
      }
      const lesson = await prisma.lessonCard.findFirst({
        where: { id: lessonId },
      });
      if (!lesson) {
        throw new AuthenticationError('课程不存在');
      }
    } else {
      // 老师在课程详情页访问，需登录并验证课程归属
      const session = await auth();
      if (!session?.user?.id) {
        throw new AuthenticationError('请先登录');
      }
      const userId = Number(session.user.id);

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
    }

    const works = await prisma.upload.findMany({
      where: {
        lessonId,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
        suggestedStudent: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    const data = works.map(work => ({
      ...work,
      url: storage?.getUrl(work.filePath) || '',
    }));

    const stats = data.reduce(
      (acc, work) => {
        acc.total += 1;
        switch (work.triageStatus) {
          case 'auto_matched':
            acc.autoMatched += 1;
            break;
          case 'pending_confirmation':
            acc.pendingConfirmation += 1;
            break;
          case 'pending_manual':
            acc.pendingManual += 1;
            break;
          case 'confirmed':
            acc.confirmed += 1;
            break;
          case 'pending':
            acc.pending += 1;
            break;
          case 'processing':
            acc.processing += 1;
            break;
          case 'failed':
            acc.failed += 1;
            break;
          default:
            break;
        }
        return acc;
      },
      {
        total: 0,
        confirmed: 0,
        autoMatched: 0,
        pendingConfirmation: 0,
        pendingManual: 0,
        pending: 0,
        processing: 0,
        failed: 0,
      }
    );

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
      stats: {
        ...stats,
        toArchive: stats.autoMatched + stats.pendingConfirmation + stats.pendingManual,
        inProgress: stats.pending + stats.processing,
      },
    });
  } catch (error) {
    console.error('获取学生作品失败:', error);

    if (error instanceof AuthenticationError || error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
