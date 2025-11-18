/**
 * AddStudentForm
 * Client-side wrapper around the createStudent server action,
 * with a confirmation dialog when adding a student with a duplicate name
 * and no nickname.
 */

'use client';

import type React from 'react';
import { createStudent } from '@/app/actions/students';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface AddStudentFormProps {
  classId: number;
  existingNames: string[];
}

export function AddStudentForm({ classId, existingNames }: AddStudentFormProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const formData = new FormData(form);

    const name = (formData.get('name') ?? '').toString().trim();
    const nickname = (formData.get('nickname') ?? '').toString().trim();

    // If nickname is empty and there is already a student with the same name,
    // ask for confirmation before adding another student with the same name.
    if (name && !nickname) {
      const hasDuplicate = existingNames.includes(name);
      if (hasDuplicate) {
        const confirmed = window.confirm(
          '本班中已存在同名学生，确定仍然添加一个没有备注名的新学生吗？\n\n' +
            '建议为同名学生设置不同的备注名，例如「大张三、小张三」，方便区分。'
        );
        if (!confirmed) {
          event.preventDefault();
        }
      }
    }
  }

  return (
    <form action={createStudent} className="space-y-4" onSubmit={handleSubmit}>
      <input type="hidden" name="classId" value={classId} />
      <div className="space-y-2">
        <Label htmlFor="name">学生姓名</Label>
        <Input id="name" name="name" placeholder="例如：张三" required autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nickname">备注名（可选）</Label>
        <Input id="nickname" name="nickname" placeholder="例如：大张三、小张三" />
      </div>
      <Button type="submit" className="w-full">
        添加学生
      </Button>
    </form>
  );
}
