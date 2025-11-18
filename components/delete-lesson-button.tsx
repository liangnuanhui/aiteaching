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
}

export function DeleteLessonButton({ lessonId }: DeleteLessonButtonProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm('确定要删除这张课程卡片吗？此操作不可恢复。');
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
