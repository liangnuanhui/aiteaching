/**
 * DeleteLessonButton
 * 删除课程卡片前弹出确认提示，防止误删。
 */

'use client';

import type React from 'react';
import { deleteLesson } from '@/app/actions/lessons';
import { Button } from '@/components/ui/button';

interface DeleteLessonButtonProps {
  lessonId: number;
  uploadsCount?: number;
  reportsCount?: number;
}

export function DeleteLessonButton({
  lessonId,
  uploadsCount = 0,
  reportsCount = 0,
}: DeleteLessonButtonProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const parts: string[] = [];
    if (uploadsCount > 0) {
      parts.push(`学生作品 ${uploadsCount} 张`);
    }
    if (reportsCount > 0) {
      parts.push(`AI 报告 ${reportsCount} 条`);
    }

    const detail = parts.length > 0 ? `\n\n⚠️ 将同时删除：${parts.join('、')}。` : '';
    const confirmed = window.confirm(`确定要删除这张课程卡片吗？此操作不可恢复。${detail}`);
    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <form action={deleteLesson} onSubmit={handleSubmit}>
      <input type="hidden" name="lessonId" value={lessonId} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="h-8 px-0 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        删除
      </Button>
    </form>
  );
}
