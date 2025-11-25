'use client';

import { AlertTriangleIcon, InfoIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { DuplicateWarning } from '@/lib/upload/duplicate-detector';

interface DuplicateWarningProps {
  files: Array<{
    name: string;
    size: number;
    type: string;
  }>;
  warnings: Record<string, DuplicateWarning[]>;
  onConfirm: (filesToUpload: Array<{ name: string; hash: string; size: number }>) => void;
  onCancel: () => void;
}

interface FileWarning {
  file: {
    name: string;
    size: number;
    type: string;
  };
  warnings: DuplicateWarning[];
}

export function DuplicateWarningModal({
  files,
  warnings,
  onConfirm,
  onCancel,
}: DuplicateWarningProps) {
  // 将警告按文件分组
  const filesWithWarnings: FileWarning[] = files
    .map(file => ({
      file,
      warnings: warnings[file.name] || [],
    }))
    .filter(fw => fw.warnings.length > 0);

  // 排序：高严重度优先，然后按文件名
  filesWithWarnings.sort((a, b) => {
    const hasHighA = a.warnings.some(w => w.severity === 'HIGH');
    const hasHighB = b.warnings.some(w => w.severity === 'HIGH');
    if (hasHighA && !hasHighB) return -1;
    if (!hasHighA && hasHighB) return 1;
    return a.file.name.localeCompare(b.file.name);
  });

  // 统计
  const stats = {
    total: files.length,
    withWarnings: filesWithWarnings.length,
    highSeverity: filesWithWarnings.filter(fw => fw.warnings.some(w => w.severity === 'HIGH'))
      .length,
  };

  const handleSkipDuplicates = () => {
    // 简化：只跳过有 HIGH severity 的 recent_filename 警告
    // recent_filename 是真正的重复
    const filesToKeep = files.filter(f => {
      const ws = warnings[f.name] || [];
      const shouldSkip = ws.some(w => w.severity === 'HIGH' && w.type === 'recent_filename');
      return !shouldSkip;
    });

    onConfirm(
      filesToKeep.map(f => ({
        name: f.name,
        hash: '',
        size: f.size,
      }))
    );
  };

  const handleUploadAll = () => {
    onConfirm(
      files.map(f => ({
        name: f.name,
        hash: '',
        size: f.size,
      }))
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900 dark:bg-red-950/20';
      case 'MEDIUM':
        return 'text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-900 dark:bg-amber-950/20';
      case 'LOW':
        return 'text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-900 dark:bg-blue-950/20';
      default:
        return 'text-muted-foreground border-border bg-muted/50';
    }
  };

  const getWarningIcon = (type: string) => {
    switch (type) {
      case 'recent_filename':
        return '⏰';
      default:
        return '⚠️';
    }
  };

  const formatTimeAgo = (minutes: number): string => {
    if (minutes < 1) {
      return '刚刚';
    } else if (minutes < 60) {
      return `${minutes} 分钟前`;
    } else {
      const hours = Math.floor(minutes / 60);
      return `${hours} 小时前`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <CardContent className="p-0">
          {/* Header */}
          <div className="border-b p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30">
                  <AlertTriangleIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">检测到可能的重复上传</h2>
                  <p className="text-sm text-muted-foreground">
                    发现 {stats.withWarnings} 个文件有重复风险
                  </p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Summary */}
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3">
              <div className="text-center">
                <div className="text-lg font-semibold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">总计</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{stats.withWarnings}</div>
                <div className="text-xs text-muted-foreground">有警告</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">{stats.highSeverity}</div>
                <div className="text-xs text-muted-foreground text-red-600">需要确认</div>
              </div>
            </div>
          </div>

          {/* File list */}
          <div className="max-h-96 overflow-y-auto p-6 pt-4">
            <div className="space-y-3">
              {filesWithWarnings.map(({ file, warnings }) => {
                const highSeverity = warnings.some(w => w.severity === 'HIGH');
                const mediumSeverity = warnings.some(w => w.severity === 'MEDIUM');

                return (
                  <div
                    key={file.name}
                    className="rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {highSeverity && <div className="h-2 w-2 rounded-full bg-red-500"></div>}
                        {mediumSeverity && !highSeverity && (
                          <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                        )}
                        {!highSeverity && !mediumSeverity && (
                          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 ml-6 space-y-1">
                      {warnings.map((warning, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-2 rounded-md border-l-4 px-2 py-1 text-xs ${getSeverityColor(
                            warning.severity
                          )}`}
                        >
                          <span>{getWarningIcon(warning.type)}</span>
                          <span className="flex-1">
                            {warning.type === 'recent_filename' && warning.existingUpload && (
                              <>
                                {formatTimeAgo(
                                  Math.floor(
                                    (Date.now() - warning.existingUpload.uploadedAt * 1000) / 60000
                                  )
                                )}
                                已上传过此文件
                              </>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t p-6">
            <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
              <InfoIcon className="h-3 w-3" />
              <span>建议：您可以跳过重复文件，或继续上传所有文件</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel} className="flex-1">
                取消上传
              </Button>
              <Button variant="secondary" onClick={handleSkipDuplicates} className="flex-1">
                跳过重复
              </Button>
              <Button
                onClick={handleUploadAll}
                className="flex-1 bg-amber-500 text-white hover:bg-amber-600"
              >
                全部上传
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
