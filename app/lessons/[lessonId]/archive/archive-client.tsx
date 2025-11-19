/**
 * Archive Client Component
 * Client-side component with all interactive sections
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AutoMatchedSection } from '@/components/archive/auto-matched-section';
import { PendingConfirmationSection } from '@/components/archive/pending-confirmation-section';
import { PendingManualSection } from '@/components/archive/pending-manual-section';

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
  student: Student | null;
  suggestedStudent: Student | null;
}

interface ArchiveClientProps {
  lessonId: number;
  uploads: {
    autoMatched: Upload[];
    pendingConfirmation: Upload[];
    pendingManual: Upload[];
    confirmed: Upload[];
    pending: Upload[];
    processing: Upload[];
    failed: Upload[];
  };
  students: Student[];
}

export function ArchiveClient({ lessonId, uploads: initialUploads, students }: ArchiveClientProps) {
  const router = useRouter();
  const [uploads, setUploads] = useState(initialUploads);

  const handleConfirmAll = async () => {
    try {
      const uploadIds = uploads.autoMatched.map(u => u.id);

      const response = await fetch('/api/uploads/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'confirm_auto_matched',
          uploadIds,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm uploads');
      }

      const result = await response.json();
      alert(`成功归档 ${result.success} 个作品`);

      // Refresh page
      router.refresh();
    } catch (error) {
      console.error('Failed to confirm all:', error);
      alert('批量确认失败，请重试');
    }
  };

  const handleConfirmSuggestion = async (uploadId: number, studentId: number) => {
    try {
      const response = await fetch(`/api/uploads/${uploadId}/triage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'confirmed',
          studentId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm upload');
      }

      // Refresh page
      router.refresh();
    } catch (error) {
      console.error('Failed to confirm suggestion:', error);
      alert('确认失败，请重试');
    }
  };

  const handleManualAssign = async (uploadId: number, studentId: number) => {
    try {
      const response = await fetch(`/api/uploads/${uploadId}/triage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'confirmed',
          studentId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to assign upload');
      }

      // Refresh page
      router.refresh();
    } catch (error) {
      console.error('Failed to manual assign:', error);
      alert('归档失败，请重试');
    }
  };

  const hasAnyPending =
    uploads.autoMatched.length > 0 ||
    uploads.pendingConfirmation.length > 0 ||
    uploads.pendingManual.length > 0;

  return (
    <>
      {!hasAnyPending && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center mb-8">
          <div className="text-2xl font-semibold text-green-900 mb-2">✅ 归档完成！</div>
          <div className="text-green-700 mb-4">所有作品已成功归档到对应学生</div>
          <button
            onClick={() => router.push(`/lessons/${lessonId}`)}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            返回课程详情
          </button>
        </div>
      )}

      <AutoMatchedSection uploads={uploads.autoMatched} onConfirmAll={handleConfirmAll} />

      <PendingConfirmationSection
        uploads={uploads.pendingConfirmation}
        students={students}
        onConfirm={handleConfirmSuggestion}
      />

      <PendingManualSection
        uploads={uploads.pendingManual}
        students={students}
        onAssign={handleManualAssign}
      />

      {/* Refresh Button */}
      {(uploads.pending.length > 0 || uploads.processing.length > 0) && (
        <div className="text-center mt-8">
          <button
            onClick={() => router.refresh()}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            刷新页面查看处理结果
          </button>
        </div>
      )}
    </>
  );
}
