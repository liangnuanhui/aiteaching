/**
 * LessonPlanEditor
 * 教案编辑：单一大文本框 + 模板 + 自动保存
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { autosaveLessonPlan, updateLessonPlan } from '@/app/actions/lessons';

interface LessonPlanEditorProps {
  lessonId: number;
  initialMdPlan: string | null;
}

export function LessonPlanEditor({ lessonId, initialMdPlan }: LessonPlanEditorProps) {
  const [content, setContent] = useState(() => initialMdPlan || buildDefaultTemplate());
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 自动保存：用户停止输入一段时间后触发
  useEffect(() => {
    if (!hasChanges) return;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          setIsSaving(true);
          const fd = new FormData();
          fd.set('lessonId', String(lessonId));
          fd.set('mdPlan', content);
          await autosaveLessonPlan(fd);
          setLastSavedAt(new Date());
          setHasChanges(false);
        } catch {
          // 自动保存失败时静默处理，避免打断老师输入
        } finally {
          setIsSaving(false);
        }
      })();
    }, 4000);

    return () => {
      clearTimeout(timer);
    };
  }, [content, hasChanges, lessonId]);

  const lastSavedLabel = useMemo(() => {
    if (!lastSavedAt) return '尚未保存或刚从系统加载';
    const h = String(lastSavedAt.getHours()).padStart(2, '0');
    const m = String(lastSavedAt.getMinutes()).padStart(2, '0');
    const s = String(lastSavedAt.getSeconds()).padStart(2, '0');
    return `已自动保存 · ${h}:${m}:${s}`;
  }, [lastSavedAt]);

  return (
    <form action={updateLessonPlan} className="space-y-4">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="mdPlan" value={content} />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>完整教案编辑</span>
        <span>{isSaving ? '正在自动保存…' : hasChanges ? '有未保存修改' : lastSavedLabel}</span>
      </div>

      <div className="rounded-md border bg-muted/40 px-4 py-3">
        <textarea
          value={content}
          onChange={e => {
            setContent(e.target.value);
            setHasChanges(true);
          }}
          rows={24}
          className="mx-auto w-full max-w-3xl rounded-md border border-input bg-background px-4 py-3 text-sm leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="在这里编写本节课的完整教案。系统会按固定结构进行保存。"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm">
          保存教案
        </Button>
      </div>
    </form>
  );
}

function buildDefaultTemplate(): string {
  return [
    '## 一、教学目标',
    '（在此填写教学目标，如：认知目标、能力目标、情感目标等）',
    '',
    '## 二、教学重难点',
    '（在此说明本课的重点和难点）',
    '',
    '## 三、课前准备',
    '（在此列出课前需要准备的教具、材料和学生预习内容）',
    '',
    '## 四、教学步骤',
    '（按“导入—展开—巩固—总结”的结构分段描述，每段写出教师活动和学生活动）',
    '',
    '## 五、互动活动设计',
    '（在此设计 1–2 个适合本年级学生的互动活动）',
    '',
    '## 六、课堂总结与教学反思',
    '（在此写课堂总结和课后反思提示）',
    '',
  ].join('\n');
}
