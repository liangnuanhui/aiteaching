/**
 * DeleteStudentButton
 * Client-side wrapper around the deleteStudent server action,
 * with a confirmation dialog to prevent accidental deletion.
 */

'use client';

import type React from 'react';
import { deleteStudent } from '@/app/actions/students';
import { Button } from '@/components/ui/button';

interface DeleteStudentButtonProps {
  classId: number;
  studentId: number;
}

export function DeleteStudentButton({ classId, studentId }: DeleteStudentButtonProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm('确定要删除该学生吗？此操作不可恢复。');
    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <form action={deleteStudent} onSubmit={handleSubmit}>
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="studentId" value={studentId} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="text-red-600 border-red-200 hover:bg-red-50"
      >
        删除
      </Button>
    </form>
  );
}
