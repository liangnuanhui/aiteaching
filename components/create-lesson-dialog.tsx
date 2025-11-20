/**
 * CreateLessonDialog
 * Dashboard 页使用的“AI 创建课程”浮层：
 * - 显示一个按钮（放在欢迎语下方）
 * - 点击后弹出悬浮卡片，点击空白处关闭
 */

'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ClassOption {
  id: number;
  name: string;
  gradeLevel: string;
}

interface CreateLessonDialogProps {
  classes: ClassOption[];
}

export function CreateLessonDialog({ classes }: CreateLessonDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  if (classes.length === 0) {
    // 没有班级时不显示按钮，避免老师困惑
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        使用 AI 创建新课程
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 px-4 py-10"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl bg-background shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">快速新建课程</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  选择班级和课程主题，系统会自动调用 AI 生成教案和展示内容。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                关闭
              </button>
            </div>

            <div className="px-5 py-4">
              <form
                className="space-y-3"
                onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  if (submitting) return;

                  const form = event.currentTarget;
                  const formData = new FormData(form);
                  const classId = formData.get('classId');
                  const title = (formData.get('title') || '').toString().trim();

                  if (!title) {
                    alert('请输入课程主题');
                    return;
                  }

                  setSubmitting(true);
                  setProgress(5);

                  const start = Date.now();
                  const timer = window.setInterval(() => {
                    const elapsed = Date.now() - start;
                    const target = Math.min(95, 5 + (elapsed / 60000) * 90);
                    setProgress(target);
                  }, 500);

                  try {
                    const response = await fetch('/api/lessons', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        classId: Number(classId),
                        title,
                      }),
                    });

                    window.clearInterval(timer);
                    setProgress(100);

                    if (!response.ok) {
                      const text = await response.text();
                      console.error('Create lesson failed:', text);
                      alert('创建课程失败，请稍后重试。');
                      setSubmitting(false);
                      setProgress(0);
                      return;
                    }

                    const data = (await response.json()) as {
                      data?: { id?: number };
                      id?: number;
                    };
                    const lessonId = data?.data?.id ?? data?.id;

                    setTimeout(() => {
                      setOpen(false);
                      setSubmitting(false);
                      setProgress(0);
                      if (lessonId) {
                        router.push(`/lessons/${lessonId}`);
                      } else {
                        router.refresh();
                      }
                    }, 300);
                  } catch (error) {
                    window.clearInterval(timer);
                    console.error('Create lesson error:', error);
                    alert('网络或服务器异常，创建课程失败。');
                    setSubmitting(false);
                    setProgress(0);
                  }
                }}
              >
                <div className="space-y-2">
                  <label htmlFor="dashboard-class-id" className="text-sm font-medium">
                    选择班级
                  </label>
                  <select
                    id="dashboard-class-id"
                    name="classId"
                    defaultValue={classes[0]?.id ?? ''}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}（{cls.gradeLevel}）
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="dashboard-lesson-title" className="text-sm font-medium">
                    课程主题
                  </label>
                  <input
                    id="dashboard-lesson-title"
                    name="title"
                    type="text"
                    required
                    placeholder="例如：关于友谊的班会课"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? '正在创建课程…' : '创建课程'}
                  </button>
                  {submitting && (
                    <>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-[width] duration-500 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        正在调用 AI 生成教案和课件，这通常需要 10–60 秒。请不要重复点击或关闭页面。
                      </p>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
