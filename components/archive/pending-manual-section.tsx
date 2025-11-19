/**
 * Pending Manual Section Component
 * Displays uploads with low confidence (< 0.6)
 * Requires teacher to manually select the student
 */

'use client';

import React, { useState } from 'react';
import { StudentSelector } from './student-selector';

interface Student {
  id: number;
  name: string;
  nickname: string | null;
}

interface Upload {
  id: number;
  filePath: string;
  recognizedName: string | null;
  ocrConfidence: number | null;
  workType: string | null;
  workDescription: string | null;
}

interface PendingManualSectionProps {
  uploads: Upload[];
  students: Student[];
  onAssign: (uploadId: number, studentId: number) => Promise<void>;
}

export function PendingManualSection({ uploads, students, onAssign }: PendingManualSectionProps) {
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [assigning, setAssigning] = useState<Record<number, boolean>>({});

  const handleAssign = async (uploadId: number) => {
    const studentId = selections[uploadId];
    if (!studentId) {
      alert('请先选择学生');
      return;
    }

    setAssigning(prev => ({ ...prev, [uploadId]: true }));
    try {
      await onAssign(uploadId, studentId);
    } finally {
      setAssigning(prev => ({ ...prev, [uploadId]: false }));
    }
  };

  if (uploads.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">步骤3: 手动归档 ({uploads.length}个)</h2>
        <p className="text-sm text-gray-600 mt-1">以下作品无法自动识别，请手动选择对应的学生</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {uploads.map(upload => (
          <div key={upload.id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="relative w-full h-48 bg-gray-100">
              <img
                src={`/api/upload?key=${encodeURIComponent(upload.filePath)}`}
                alt={`作品 ${upload.id}`}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="p-3">
              <div className="mb-2">
                {upload.recognizedName && (
                  <div className="text-xs text-gray-400 mb-1">识别: {upload.recognizedName}</div>
                )}
                {upload.workType && (
                  <div className="text-xs text-gray-500 mb-1">类型: {upload.workType}</div>
                )}
                {!upload.recognizedName && (
                  <div className="text-xs text-red-500 mb-1">未识别到姓名</div>
                )}
              </div>

              <StudentSelector
                students={students}
                value={selections[upload.id] || null}
                onChange={studentId => setSelections(prev => ({ ...prev, [upload.id]: studentId }))}
                className="mb-2"
              />

              <button
                onClick={() => handleAssign(upload.id)}
                disabled={!selections[upload.id] || assigning[upload.id]}
                className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {assigning[upload.id] ? '归档中...' : '确认归档'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
