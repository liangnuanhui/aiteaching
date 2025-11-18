/**
 * CreateLessonSubmitButton
 * 用于创建课程卡片表单的提交按钮：
 * - 使用 useFormStatus 感知提交中的状态
 * - 显示明确的“正在生成教案”进度提示
 * - 禁用按钮，防止教师重复点击造成重复课程
 */

'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

export function CreateLessonSubmitButton() {
  const { pending } = useFormStatus();
  const [progress, setProgress] = useState(0);
  const [clicked, setClicked] = useState(false);

  const isPending = pending || clicked;

  useEffect(() => {
    if (!isPending) {
      setProgress(0);
      return;
    }

    setProgress(5);
    const start = Date.now();
    const timer = setInterval(() => {
      setProgress(() => {
        const elapsed = Date.now() - start;
        // 在约 25 秒内缓慢推进到 95%，避免过早到 100%
        const pct = Math.min(95, 5 + (elapsed / 25000) * 90);
        return pct;
      });
    }, 500);

    return () => clearInterval(timer);
  }, [isPending]);

  // 如果表单提交失败而页面没有跳转，Next 会把 pending 置为 false，这里同步重置本地 clicked 状态
  useEffect(() => {
    if (!pending) {
      setClicked(false);
    }
  }, [pending]);

  return (
    <div className="space-y-1">
      <Button
        type="submit"
        className="w-full md:w-auto"
        disabled={isPending}
        onClick={() => {
          if (!isPending) {
            setClicked(true);
          }
        }}
      >
        {isPending ? '正在创建课程…' : '创建课程'}
      </Button>
      {isPending && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            正在调用 AI 生成教案和课件，这通常需要 10–30 秒。请不要重复点击或关闭页面。
          </p>
        </div>
      )}
    </div>
  );
}
