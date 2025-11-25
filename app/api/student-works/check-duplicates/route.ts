import { NextRequest, NextResponse } from 'next/server';
import { duplicateDetector } from '@/lib/upload/duplicate-detector';
import { verifyLessonUploadToken } from '@/lib/lesson-upload-token';
import { MissingRequiredFieldError, ValidationError } from '@/lib/errors';

export const runtime = 'nodejs';

interface CheckDuplicatesRequest {
  lessonId: number;
  files: Array<{
    name: string;
    hash: string;
    size: number;
  }>;
  uploadTime?: number;
}

/**
 * POST /api/student-works/check-duplicates
 * 检查上传文件是否重复（文件名 + 时间窗口检测）
 *
 * 支持检测：
 * 1. 同一批次内的重复选择（same_batch）
 * 2. 近期（30分钟内）已上传的同名文件（recent_filename）
 * 3. 相似文件名（IMG_5418 vs IMG_5419）（similar_names）
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckDuplicatesRequest;

    const { lessonId, files, uploadTime } = body;

    if (!lessonId) {
      throw new MissingRequiredFieldError('lessonId');
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new MissingRequiredFieldError('files');
    }

    // 验证上传token（从URL参数或header获取）
    const token = request.headers.get('x-upload-token') || '';
    const valid = verifyLessonUploadToken(lessonId, token);

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid or missing upload token', code: 'INVALID_TOKEN' },
        { status: 403 }
      );
    }

    // 执行重复检测
    const warnings = await duplicateDetector.detectDuplicates(lessonId, files, uploadTime);

    // 统计
    const totalWarnings = files.filter(f => warnings.has(f.name)).length;
    const highSeverityWarnings = Array.from(warnings.values()).filter(ws =>
      ws.some(w => w.severity === 'HIGH')
    ).length;

    // 计算建议操作
    const filtered = duplicateDetector.filterDuplicates(files, warnings);

    return NextResponse.json({
      success: true,
      warnings: Object.fromEntries(warnings),
      summary: {
        totalFiles: files.length,
        filesWithWarnings: totalWarnings,
        highSeverityWarnings,
        canProceed: highSeverityWarnings < files.length, // 只要不是全部文件都有严重警告，就可以继续
        suggestedAction: highSeverityWarnings > files.length / 2 ? 'review' : 'proceed', // >50%有警告则建议审查
      },
      filtered: {
        keep: filtered.keep,
        skip: filtered.skip,
        keepCount: filtered.keep.length,
        skipCount: filtered.skip.length,
      },
    });
  } catch (error) {
    console.error('检查重复文件失败:', error);

    if (error instanceof MissingRequiredFieldError || error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
