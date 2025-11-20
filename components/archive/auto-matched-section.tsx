/**
 * Auto-Matched Section Component
 * Displays uploads that were automatically matched (confidence > 0.8)
 * Allows teacher to batch confirm them
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Trash2 } from 'lucide-react';

interface Upload {
  id: number;
  filePath: string;
  previewUrl?: string;
  recognizedName: string | null;
  ocrConfidence: number | null;
  workType: string | null;
  workDescription: string | null;
  student: {
    id: number;
    name: string;
    nickname: string | null;
  } | null;
}

interface AutoMatchedSectionProps {
  uploads: Upload[];
  onConfirmAll: () => Promise<void>;
  onDelete?: (uploadId: number) => Promise<void>;
}

export function AutoMatchedSection({ uploads, onConfirmAll, onDelete }: AutoMatchedSectionProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [deleting, setDeleting] = useState<Record<number, boolean>>({});

  const handleConfirmAll = async () => {
    setIsConfirming(true);
    try {
      await onConfirmAll();
    } finally {
      setIsConfirming(false);
    }
  };

  if (uploads.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">步骤1: 自动归档 ({uploads.length}个)</h2>
          <p className="text-sm text-gray-600 mt-1">
            以下作品已自动识别并匹配到学生，请确认无误后批量归档
          </p>
        </div>
        <button
          onClick={handleConfirmAll}
          disabled={isConfirming}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isConfirming ? '确认中...' : '批量确认归档'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {uploads.map(upload => (
          <div key={upload.id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="relative w-full h-48 bg-gray-100">
              {(() => {
                const imageSrc =
                  upload.previewUrl ||
                  (upload.filePath
                    ? `/api/upload?key=${encodeURIComponent(upload.filePath)}`
                    : undefined);
                if (!imageSrc) {
                  return (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                      无预览
                    </div>
                  );
                }

                return (
                  <Image
                    src={imageSrc}
                    alt={`作品 ${upload.id}`}
                    fill
                    className="object-contain"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                  />
                );
              })()}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm('确认删除该作品吗？删除后不可恢复。')) return;
                    setDeleting(prev => ({ ...prev, [upload.id]: true }));
                    void onDelete(upload.id).finally(() =>
                      setDeleting(prev => ({ ...prev, [upload.id]: false }))
                    );
                  }}
                  className="absolute right-2 top-2 rounded-full bg-white/80 p-1 text-gray-700 shadow hover:bg-white"
                  disabled={deleting[upload.id]}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-lg">
                  {upload.student?.name}
                  {upload.student?.nickname && (
                    <span className="text-sm text-gray-500 ml-1">({upload.student.nickname})</span>
                  )}
                </span>
                <span className="text-xs text-green-600 font-medium">
                  {upload.ocrConfidence ? `${(upload.ocrConfidence * 100).toFixed(0)}%` : ''}
                </span>
              </div>
              {upload.workType && (
                <div className="text-xs text-gray-500 mb-1">类型: {upload.workType}</div>
              )}
              {upload.recognizedName && (
                <div className="text-xs text-gray-400">识别: {upload.recognizedName}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
