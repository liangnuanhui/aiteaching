/**
 * Pending Confirmation Section Component
 * Displays uploads with medium confidence (0.6-0.8)
 * Shows AI suggestion and allows teacher to confirm or choose different student
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Trash2 } from 'lucide-react';
import { StudentSelector } from './student-selector';

interface Student {
  id: number;
  name: string;
  nickname: string | null;
}

interface Upload {
  id: number;
  filePath: string;
  previewUrl?: string;
  recognizedName: string | null;
  ocrConfidence: number | null;
  workType: string | null;
  workDescription: string | null;
  suggestedStudent: Student | null;
}

interface PendingConfirmationSectionProps {
  uploads: Upload[];
  students: Student[];
  onConfirm: (uploadId: number, studentId: number) => Promise<void>;
  onDelete?: (uploadId: number) => Promise<void>;
}

export function PendingConfirmationSection({
  uploads,
  students,
  onConfirm,
  onDelete,
}: PendingConfirmationSectionProps) {
  const [selections, setSelections] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {};
    uploads.forEach(u => {
      if (u.suggestedStudent) {
        initial[u.id] = u.suggestedStudent.id;
      }
    });
    return initial;
  });

  const [confirming, setConfirming] = useState<Record<number, boolean>>({});
  const [deleting, setDeleting] = useState<Record<number, boolean>>({});

  const handleConfirm = async (uploadId: number) => {
    const studentId = selections[uploadId];
    if (!studentId) {
      alert('请先选择学生');
      return;
    }

    setConfirming(prev => ({ ...prev, [uploadId]: true }));
    try {
      await onConfirm(uploadId, studentId);
    } finally {
      setConfirming(prev => ({ ...prev, [uploadId]: false }));
    }
  };

  if (uploads.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">步骤2: AI建议确认 ({uploads.length}个)</h2>
        <p className="text-sm text-gray-600 mt-1">以下作品AI给出了建议，请确认或选择正确的学生</p>
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
                    void onDelete(upload.id)
                      .catch(() => undefined)
                      .finally(() => setDeleting(prev => ({ ...prev, [upload.id]: false })));
                  }}
                  className="absolute right-2 top-2 rounded-full bg-white/80 p-1 text-gray-700 shadow hover:bg-white"
                  disabled={deleting[upload.id]}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="p-3">
              <div className="mb-2">
                {upload.suggestedStudent && (
                  <div className="text-sm text-blue-600 mb-1">
                    AI建议: {upload.suggestedStudent.name}
                    {upload.suggestedStudent.nickname && (
                      <span className="text-gray-500"> ({upload.suggestedStudent.nickname})</span>
                    )}
                  </div>
                )}
                {upload.recognizedName && (
                  <div className="text-xs text-gray-400 mb-1">识别: {upload.recognizedName}</div>
                )}
                {upload.workType && (
                  <div className="text-xs text-gray-500 mb-1">类型: {upload.workType}</div>
                )}
              </div>

              <StudentSelector
                students={students}
                value={selections[upload.id] || null}
                onChange={studentId => setSelections(prev => ({ ...prev, [upload.id]: studentId }))}
                className="mb-2"
              />

              <button
                onClick={() => handleConfirm(upload.id)}
                disabled={!selections[upload.id] || confirming[upload.id] || deleting[upload.id]}
                className="w-full px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {confirming[upload.id] ? '确认中...' : '确认归档'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
