/**
 * H5Uploader
 * 学生作品上传组件（H5 页面使用）
 * - 支持多文件选择与预览
 * - 使用统一上传接口 /api/upload 保存到存储（本地/R2）
 * - 调用 /api/student-works 记录到数据库
 */

'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ImageIcon, UploadIcon, XIcon } from 'lucide-react';

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
}

export function H5Uploader({ lessonId, uploadToken }: H5UploaderProps) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    setFiles(selected);
    const urls = Array.from(selected).map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
  };

  const clearSelection = () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    setFiles(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) {
      alert('请先选择要上传的作品照片。');
      return;
    }

    setIsUploading(true);

    try {
      // 1. 上传文件到统一存储（本地/R2），使用课程级上传 token
      const uploadResults: UploadedFile[] = [];

      for (const file of Array.from(files)) {
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

        const data = await res.json();
        uploadResults.push({
          key: data.key,
          url: data.url,
          size: data.size,
          contentType: data.contentType,
          name: data.name || file.name,
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

      setUploadedFiles(prev => [...uploadResults, ...prev]);
      alert(`上传成功！共 ${uploadResults.length} 个作品。`);
      clearSelection();
    } catch (error) {
      console.error('上传学生作品失败:', error);
      alert('上传失败，请检查网络后重试。');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
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
              支持 JPG、PNG、PDF，每张不超过 10MB
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
      {uploadedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium">已上传作品</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {uploadedFiles.map((file, idx) => (
              <Card key={idx} className="overflow-hidden">
                <CardContent className="p-2">
                  {file.contentType?.startsWith('image/') ? (
                    <Image
                      src={file.url}
                      alt={file.name}
                      width={120}
                      height={120}
                      className="h-20 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-full items-center justify-center rounded bg-muted">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <p className="mt-1 truncate text-xs text-muted-foreground">{file.name}</p>
                </CardContent>
              </Card>
            ))}
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
