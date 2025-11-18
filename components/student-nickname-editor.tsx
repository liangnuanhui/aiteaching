/**
 * StudentNicknameEditor
 * 行内编辑学生备注名的组件：
 * - 默认显示备注或提示
 * - 点击「编辑备注」后变成输入框 + 保存/取消
 */

'use client';

import { useState } from 'react';
import { updateStudentNickname } from '@/app/actions/students';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface StudentNicknameEditorProps {
  classId: number;
  studentId: number;
  nickname: string | null;
  hasDuplicateName: boolean;
}

export function StudentNicknameEditor({
  classId,
  studentId,
  nickname,
  hasDuplicateName,
}: StudentNicknameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (!isEditing) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {nickname ? (
          <span className="text-xs text-muted-foreground">备注名：{nickname}</span>
        ) : hasDuplicateName ? (
          <span className="text-xs text-amber-700">已有同名学生，建议添加备注名。</span>
        ) : (
          <span className="text-xs text-muted-foreground">暂无备注名</span>
        )}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0 text-xs"
          onClick={() => setIsEditing(true)}
        >
          {nickname ? '编辑备注' : '添加备注'}
        </Button>
      </div>
    );
  }

  return (
    <form action={updateStudentNickname} className="mt-1 flex flex-wrap items-center gap-2">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="studentId" value={studentId} />
      <Input
        name="nickname"
        defaultValue={nickname ?? ''}
        placeholder="例如：大张三、小张三"
        autoFocus
        className="h-9 flex-1 min-w-[140px] px-3 text-sm"
      />
      <Button type="submit" size="sm" className="h-8 px-3 text-xs">
        保存
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={() => setIsEditing(false)}
      >
        取消
      </Button>
    </form>
  );
}
