import { createPrismaClient } from '@/lib/db/client';

export interface DuplicateWarning {
  type: 'recent_filename' | 'similar_names'; // 移除了'same_batch'，移动端无法实现
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  existingUpload?: {
    originalFilename: string;
    uploadedAt: number;
    fileHash: string;
  };
  similarFiles?: string[];
}

export interface FileCheckItem {
  name: string;
  hash: string;
  size: number;
}

/**
 * 重复检测器 - D方案简化版
 * 只保留实际有效的检测：近期同名（7天）+ 文件大小相似
 * 移除了同批次检测（same_batch），因为移动端无法实现选择同一个文件两次
 * 移除了相似文件名检测（similar_names），因为连续拍摄是正常场景
 */
export class DuplicateDetector {
  private prisma = createPrismaClient();
  private timeWindows = {
    recent: 7 * 24 * 60 * 60 * 1000, // 7天（毫秒）- 更符合教学场景的实际需求
  };

  /**
   * 检测重复文件
   * @param lessonId 课程ID
   * @param files 待上传的文件列表
   * @param uploadTime 上传时间（毫秒）
   */
  async detectDuplicates(
    lessonId: number,
    files: FileCheckItem[],
    uploadTime: number = Date.now()
  ): Promise<Map<string, DuplicateWarning[]>> {
    const warnings = new Map<string, DuplicateWarning[]>();

    // 只保留有效的检测：近期（7天内）同名文件
    await this.checkRecentByFilename(lessonId, files, uploadTime, warnings);

    return warnings;
  }

  /**
   * 检测近期（7天内）上传的同名文件
   * 更符合实际教学场景：老师可能在同一节课（45分钟）或同一周（7天）内分批上传
   */
  private async checkRecentByFilename(
    lessonId: number,
    files: FileCheckItem[],
    uploadTime: number,
    warnings: Map<string, DuplicateWarning[]>
  ): Promise<void> {
    const timeWindowStart = uploadTime - this.timeWindows.recent;

    // 批量查询数据库
    const filenames = files.map(f => f.name);
    const existingUploads = await this.prisma.upload.findMany({
      where: {
        lessonId,
        originalFilename: {
          in: filenames,
        },
        uploadedAt: {
          gte: Math.floor(timeWindowStart / 1000),
        },
      },
      select: {
        originalFilename: true,
        uploadedAt: true,
        fileHash: true,
      },
    });

    // 为每个文件添加警告
    for (const upload of existingUploads) {
      const timeDiff = uploadTime - upload.uploadedAt * 1000;
      const minutesAgo = Math.floor(timeDiff / 60000);
      const hoursAgo = Math.floor(minutesAgo / 60);
      const daysAgo = Math.floor(hoursAgo / 24);

      let timeAgo = '';
      if (daysAgo > 0) {
        timeAgo = `${daysAgo} 天`;
      } else if (hoursAgo > 0) {
        timeAgo = `${hoursAgo} 小时`;
      } else if (minutesAgo > 0) {
        timeAgo = `${minutesAgo} 分钟`;
      } else {
        timeAgo = '刚刚';
      }

      if (!warnings.has(upload.originalFilename)) {
        warnings.set(upload.originalFilename, []);
      }

      warnings.get(upload.originalFilename)!.push({
        type: 'recent_filename',
        severity: daysAgo >= 1 ? 'MEDIUM' : 'HIGH', // 1天以上为中严重度，1天内为高严重度
        message: `${timeAgo}前已上传过相同文件`,
        existingUpload: {
          originalFilename: upload.originalFilename,
          uploadedAt: upload.uploadedAt,
          fileHash: upload.fileHash,
        },
      });
    }
  }

  /**
   * 过滤掉重复文件（用于批量跳过）
   * 默认保留所有文件，但在返回的 skip 列表中附带存在警告的文件，方便前端做进一步处理
   */
  filterDuplicates(
    files: FileCheckItem[],
    warnings: Map<string, DuplicateWarning[]>
  ): { keep: FileCheckItem[]; skip: FileCheckItem[] } {
    const duplicates = files.filter(file => warnings.has(file.name));
    return {
      keep: files,
      skip: duplicates,
    };
  }
}

// 单例
export const duplicateDetector = new DuplicateDetector();
