/**
 * H5Uploader
 * 学生作品上传组件（H5 页面使用）
 * - 支持多文件选择与预览
 * - 使用统一上传接口 /api/upload 保存到存储（本地/R2）
 * - 调用 /api/student-works 记录到数据库
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ImageIcon, UploadIcon, XIcon, InfoIcon } from 'lucide-react';
import { DuplicateWarningModal } from './duplicate-warning';
import type { DuplicateWarning } from '@/lib/upload/duplicate-detector';

interface H5UploaderProps {
  lessonId: number;
  uploadToken: string;
}

interface UploadedFile {
  key: string;
  url: string;
  size: number;
  contentType?: string;
  name: string;
  hash?: string;
}

interface StudentWorksCountResponse {
  count?: number;
}

interface LessonUploadResponse {
  key: string;
  url: string;
  size: number;
  contentType?: string;
  name?: string;
  hash: string;
}

interface SaveStudentWorksResponse {
  success?: boolean;
  count?: number;
  skippedDuplicates?: string[];
}

type UploadFilePayload = {
  name: string;
  hash: string;
  size: number;
};

interface CheckDuplicatesResponse {
  success: boolean;
  warnings: Record<string, DuplicateWarning[]>;
  summary: {
    totalFiles: number;
    filesWithWarnings: number;
    highSeverityWarnings: number;
    canProceed: boolean;
    suggestedAction: 'review' | 'proceed';
  };
  filtered: {
    keep: UploadFilePayload[];
    skip: UploadFilePayload[];
    keepCount: number;
    skipCount: number;
  };
}

export function H5Uploader({ lessonId, uploadToken }: H5UploaderProps) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 重复检测状态
  const [duplicateWarnings, setDuplicateWarnings] = useState<Record<string, DuplicateWarning[]>>(
    {}
  );
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  // 已选择的文件列表（转换为可管理的格式）
  const [selectedFiles, setSelectedFiles] = useState<Array<{ file: File; hash: string }>>([]);

  // 初次进入页面时，拉取当前课程已上传作品总数
  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const res = await fetch(
          `/api/student-works?lessonId=${lessonId}&token=${encodeURIComponent(uploadToken)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as StudentWorksCountResponse;
        if (!cancelled && typeof data.count === 'number') {
          setTotalCount(data.count);
        }
      } catch (error) {
        console.error('加载作品数量失败:', error);
      }
    };

    void fetchCount();

    return () => {
      cancelled = true;
    };
  }, [lessonId, uploadToken]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    setFiles(selected);
    const urls = Array.from(selected).map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);

    // 计算文件的hash（使用FileReader读取ArrayBuffer，然后用SHA-256）
    const calculateHashes = async () => {
      const filesWithHashes: Array<{ file: File; hash: string }> = [];

      for (const file of Array.from(selected)) {
        try {
          const buffer = await file.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          filesWithHashes.push({ file, hash: hashHex });
        } catch (error) {
          console.error('计算文件hash失败:', file.name, error);
          filesWithHashes.push({ file, hash: '' });
        }
      }

      setSelectedFiles(filesWithHashes);
    };

    void calculateHashes();
  };

  const clearSelection = () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    setFiles(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * 检查文件是否重复，如果有重复则显示确认对话框
   */
  const checkForDuplicates = async (): Promise<boolean> => {
    if (selectedFiles.length === 0) return false;

    setIsCheckingDuplicates(true);

    try {
      // 调用API检查重复
      const response = await fetch('/api/student-works/check-duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-upload-token': uploadToken,
        },
        body: JSON.stringify({
          lessonId,
          files: selectedFiles.map(({ file, hash }) => ({
            name: file.name,
            hash,
            size: file.size,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('检查重复失败:', error);
        setIsCheckingDuplicates(false);
        return false; // API失败，允许继续上传
      }

      const data = (await response.json()) as CheckDuplicatesResponse;
      const warnings = data.warnings ?? {};
      const summary = data.summary;

      setDuplicateWarnings(warnings);
      setIsCheckingDuplicates(false);

      // 如果有警告，显示确认对话框
      if (summary.filesWithWarnings > 0) {
        setShowDuplicateModal(true);
        return false; // 等待用户确认
      }

      return true; // 没有重复，可以继续上传
    } catch (error) {
      console.error('检查重复时发生错误:', error);
      setIsCheckingDuplicates(false);
      return false; // 发生错误，允许继续上传（不要阻塞用户）
    }
  };

  /**
   * 继续上传（在确认对话框中点击"全部上传"或"跳过重复"后调用）
   */
  const continueUpload = async (filesToUpload: UploadFilePayload[]) => {
    setShowDuplicateModal(false);
    setIsUploading(true);

    try {
      // 筛选出要上传的文件
      const filesToSend = selectedFiles.filter(sf =>
        filesToUpload.some(f => f.name === sf.file.name)
      );

      // 1. 上传文件到统一存储（本地/R2），使用课程级上传 token
      const uploadResults: UploadedFile[] = [];

      for (const { file } of filesToSend) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('lessonId', String(lessonId));
        formData.append('token', uploadToken);

        const res = await fetch('/api/lesson-upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          throw new Error('上传失败');
        }

        const data = (await res.json()) as LessonUploadResponse;
        uploadResults.push({
          key: data.key,
          url: data.url,
          size: data.size,
          contentType: data.contentType,
          name: data.name || file.name,
          hash: data.hash,
        });
      }

      // 2. 保存学生作品记录到数据库
      const saveRes = await fetch('/api/student-works', {
        method: 'POST',
        body: (() => {
          const fd = new FormData();
          fd.append('lessonId', String(lessonId));
          fd.append('token', uploadToken);
          fd.append('works', JSON.stringify(uploadResults));
          return fd;
        })(),
      });

      if (!saveRes.ok) {
        throw new Error('保存作品记录失败');
      }

      const saveData = (await saveRes.json()) as SaveStudentWorksResponse;
      const skippedDuplicates = saveData.skippedDuplicates || [];
      const createdCount =
        typeof saveData.count === 'number' ? saveData.count : uploadResults.length;

      // 3. 重新拉取当前课程的作品数量
      try {
        const countRes = await fetch(
          `/api/student-works?lessonId=${lessonId}&token=${encodeURIComponent(uploadToken)}`
        );
        if (countRes.ok) {
          const data = (await countRes.json()) as StudentWorksCountResponse;
          setTotalCount(typeof data.count === 'number' ? data.count : null);
        }
      } catch (err) {
        console.error('刷新作品数量失败:', err);
      }

      let successMessage = `上传成功！本次新增 ${createdCount} 个作品。`;
      const skippedCount = filesToSend.length - createdCount;
      if (skippedCount > 0) {
        successMessage += `\n（跳过了 ${skippedCount} 个重复文件）`;
      }
      if (skippedDuplicates.length > 0) {
        successMessage += `\n有 ${skippedDuplicates.length} 张照片已存在，系统已自动跳过。`;
      }

      alert(successMessage);
      clearSelection();
      setSelectedFiles([]);
    } catch (error) {
      console.error('上传学生作品失败:', error);
      alert('上传失败，请检查网络后重试。');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) {
      alert('请先选择要上传的作品照片。');
      return;
    }

    if (selectedFiles.length === 0) {
      alert('正在计算文件信息，请稍候...');
      return;
    }

    // 检查重复
    const isSafeToUpload = await checkForDuplicates();

    if (isSafeToUpload) {
      // 没有重复，直接上传
      continueUpload(
        selectedFiles.map(({ file, hash }) => ({
          name: file.name,
          hash,
          size: file.size,
        }))
      );
    }
    // 否则等待用户在模态框中确认
  };

  return (
    <div className="space-y-6">
      {/* 拍摄指南 */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="flex items-start gap-3 py-4">
          <InfoIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="flex-1 space-y-2 text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">拍摄提示</p>
            <ul className="space-y-1 text-blue-800 dark:text-blue-200">
              <li className="flex items-center gap-2">
                <span className="text-base">📱</span>
                <span>建议横屏拍摄，作品正面朝上</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-base">💡</span>
                <span>确保光线充足，避免阴影遮挡</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-base">✏️</span>
                <span>如有姓名，请确保字迹清晰可见</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 上传区域 */}
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/40 p-6 text-center hover:border-muted-foreground/70">
        <Input
          type="file"
          ref={fileInputRef}
          multiple
          accept="image/*,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        {previewUrls.length === 0 ? (
          <button
            type="button"
            className="flex w-full flex-col items-center justify-center gap-2 py-4 text-sm text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon className="h-10 w-10 text-muted-foreground" />
            <span>点击选择或拖拽作品照片到此处</span>
            <span className="text-xs text-muted-foreground/80">
              支持 JPG、PNG、PDF，单个文件不超过 10MB
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {previewUrls.map((url, idx) => {
              const file = files?.[idx];
              const isImage = file?.type.startsWith('image/');

              return (
                <div key={idx} className="group relative rounded-md border bg-muted/40 p-1">
                  {isImage ? (
                    <Image
                      src={url}
                      alt={file?.name || `预览 ${idx + 1}`}
                      width={160}
                      height={160}
                      className="h-28 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-full items-center justify-center rounded bg-muted">
                      <ImageIcon className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  <p className="mt-1 truncate text-xs text-muted-foreground">{file?.name}</p>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      URL.revokeObjectURL(url);
                      const remainingFiles = Array.from(files || []).filter((_, i) => i !== idx);
                      const remainingUrls = previewUrls.filter((_, i) => i !== idx);
                      setFiles(remainingFiles.length ? createFileList(remainingFiles) : null);
                      setPreviewUrls(remainingUrls);
                    }}
                    className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={handleUpload}
          disabled={isUploading || !files || files.length === 0}
          className="flex-1"
        >
          {isUploading ? '上传中…' : '开始上传'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          重新选择
        </Button>
        {previewUrls.length > 0 && (
          <Button type="button" variant="ghost" disabled={isUploading} onClick={clearSelection}>
            清空
          </Button>
        )}
      </div>

      {/* 已上传文件简单预览 */}
      {totalCount !== null && (
        <div className="mt-4">
          <Card>
            <CardContent className="py-3 text-sm text-muted-foreground">
              当前课程已上传作品数量：
              <span className="font-semibold text-foreground">{totalCount}</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 重复检测确认对话框 */}
      {showDuplicateModal && selectedFiles.length > 0 && (
        <DuplicateWarningModal
          files={selectedFiles.map(({ file }) => ({
            name: file.name,
            size: file.size,
            type: file.type,
          }))}
          warnings={duplicateWarnings}
          onConfirm={filesToUpload => continueUpload(filesToUpload)}
          onCancel={() => {
            setShowDuplicateModal(false);
            setIsUploading(false);
          }}
        />
      )}

      {/* 检测中的状态提示 */}
      {isCheckingDuplicates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-lg bg-white p-6 text-center shadow-lg">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-sm font-medium">正在检查重复文件...</p>
            <p className="text-xs text-muted-foreground">请稍候</p>
          </div>
        </div>
      )}
    </div>
  );
}

// 创建新的 FileList
function createFileList(files: File[]): FileList {
  const dataTransfer = new DataTransfer();
  files.forEach(file => dataTransfer.items.add(file));
  return dataTransfer.files;
}
