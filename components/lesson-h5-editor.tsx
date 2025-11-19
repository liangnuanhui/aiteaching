/**
 * LessonH5Editor
 * H5 幻灯片编辑组件：
 * - 支持添加文本幻灯片
 * - 支持插入外部媒体链接（图片 / 视频）
 * - 支持上传媒体文件并插入幻灯片
 * - 提交时将 slides 序列化为 h5Json，保存到课程卡片
 */

'use client';

import type React from 'react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateLessonH5 } from '@/app/actions/lessons';
import { parseSlides, type Slide } from '@/components/lesson-h5-player';

interface LessonH5EditorProps {
  lessonId: number;
  initialH5Json: string | null;
}

export function LessonH5Editor({ lessonId, initialH5Json }: LessonH5EditorProps) {
  const [slides, setSlides] = useState<Slide[]>(() => parseSlides(initialH5Json));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const hasSlides = slides.length > 0;

  const h5JsonToSubmit = useMemo(() => buildH5Json(slides), [slides]);

  function buildH5Json(currentSlides: Slide[]): string {
    const serializedSlides = currentSlides.map(slide => ({
      type: slide.type,
      title: slide.title,
      content: slide.content,
      subtitle: slide.subtitle,
      url: slide.url,
      description: slide.description,
      instruction: slide.instruction,
    }));

    return JSON.stringify(
      {
        h5_data: {
          slides: serializedSlides,
        },
      },
      null,
      2
    );
  }

  function updateSlide(index: number, patch: Partial<Slide>) {
    setSlides(prev => {
      const next = [...prev];
      const original = next[index] || {};
      next[index] = { ...original, ...patch };
      return next;
    });
  }

  function handleAddSlide() {
    setError(null);
    setSlides(prev => {
      const next: Slide[] = [
        ...prev,
        {
          type: 'text',
          content: '点击编辑添加内容',
        },
      ];
      setEditingIndex(next.length - 1);
      return next;
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (editingIndex === null || editingIndex < 0 || editingIndex >= slides.length) {
      setError('请先选择要编辑的幻灯片');
      setFileInputKey(key => key + 1);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || '上传失败');
      }

      const data = (await res.json()) as {
        url: string;
        contentType?: string;
        name?: string;
      };

      const uploadedUrl = data.url;
      const contentType = data.contentType || file.type;

      let inferredType: 'image' | 'video' | undefined;
      if (contentType.startsWith('video/')) {
        inferredType = 'video';
      } else if (contentType.startsWith('image/')) {
        inferredType = 'image';
      }

      updateSlide(editingIndex, {
        type: inferredType ?? slides[editingIndex].type ?? 'image',
        url: uploadedUrl,
        description: data.name || file.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请稍后重试');
    } finally {
      setUploading(false);
      setFileInputKey(key => key + 1);
    }
  }

  function handleDeleteSlide(index: number) {
    setSlides(prev => prev.filter((_, i) => i !== index));
  }

  const editingSlide = editingIndex !== null ? slides[editingIndex] : null;

  return (
    <form action={updateLessonH5} className="space-y-4">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="h5Json" value={h5JsonToSubmit} />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">课件幻灯片（共 {slides.length} 页）</span>
        </div>

        {hasSlides ? (
          <div className="grid gap-2 md:grid-cols-3">
            {slides.map((slide, index) => (
              <div
                key={index}
                className={`flex flex-col justify-between rounded-md border px-3 py-2 text-xs ${
                  editingIndex === index
                    ? 'border-primary ring-1 ring-primary/40 bg-muted/80'
                    : 'bg-muted/60'
                }`}
                role="button"
                tabIndex={0}
                onClick={() => setEditingIndex(index)}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      第 {index + 1} 页 · {slide.title || slide.type || '内容'}
                    </div>
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {slide.type || (slide.url ? 'media' : 'text')}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-muted-foreground">
                    {slide.type === 'image'
                      ? slide.description || slide.url
                      : slide.type === 'video'
                        ? slide.description || slide.url
                        : slide.content}
                  </div>
                </div>
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    onClick={e => {
                      e.stopPropagation();
                      handleDeleteSlide(index);
                      if (editingIndex === index) {
                        setEditingIndex(null);
                      } else if (typeof editingIndex === 'number' && editingIndex > index) {
                        setEditingIndex(editingIndex - 1);
                      }
                    }}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}

            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/40 px-3 py-4 text-xs text-muted-foreground hover:bg-muted/80"
              onClick={handleAddSlide}
              role="button"
              tabIndex={0}
            >
              <div className="text-2xl leading-none">＋</div>
              <div className="mt-1">创建新幻灯片</div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            当前还没有任何幻灯片，可以点击下方“创建新幻灯片”按钮开始编辑。
          </p>
        )}
      </div>

      {editingSlide && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
          onClick={() => setEditingIndex(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-md border bg-background p-4 text-xs shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="font-medium">
                编辑第 {editingIndex! + 1} 页（{editingSlide.type || '未指定类型'}）
              </div>
              <span className="text-muted-foreground">
                修改会保留在当前页面，关闭后记得点击“保存课件”写入课程。
              </span>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">类型</span>
                  <select
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-[11px]"
                    value={editingSlide.type || 'text'}
                    onChange={e =>
                      updateSlide(editingIndex!, {
                        type: e.target.value as Slide['type'],
                      })
                    }
                  >
                    <option value="text">文本</option>
                    <option value="image">图片</option>
                    <option value="video">视频</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    标题（可选）
                  </span>
                  <Input
                    type="text"
                    value={editingSlide.title || ''}
                    onChange={e =>
                      updateSlide(editingIndex!, {
                        title: e.target.value,
                      })
                    }
                    className="h-8 text-[11px]"
                    placeholder="用于放映时显示的大标题"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    正文内容（文本页或补充说明）
                  </span>
                  <textarea
                    value={editingSlide.content || ''}
                    onChange={e =>
                      updateSlide(editingIndex!, {
                        content: e.target.value,
                      })
                    }
                    rows={5}
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="用于课堂讲解的文字内容，例如提问、步骤或提示。"
                  />
                </div>
              </div>

              <div className="space-y-2">
                {(editingSlide.type === 'image' || editingSlide.type === 'video') && (
                  <>
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        媒体链接（图片 / 视频 URL）
                      </span>
                      <Input
                        type="text"
                        value={editingSlide.url || ''}
                        onChange={e =>
                          updateSlide(editingIndex!, {
                            url: e.target.value,
                          })
                        }
                        className="h-8 text-[11px]"
                        placeholder="可粘贴外部链接，或使用下方上传自动填充"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        媒体说明（可选）
                      </span>
                      <textarea
                        value={editingSlide.description || ''}
                        onChange={e =>
                          updateSlide(editingIndex!, {
                            description: e.target.value,
                          })
                        }
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        placeholder="可简单说明图片或视频内容，放映时显示在下方。"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        上传文件（自动填充链接）
                      </span>
                      <input
                        key={fileInputKey}
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileChange}
                        className="block w-full text-[11px]"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        选择图片或视频文件后，系统会自动上传并把可访问链接填到上面的“媒体链接”中。
                        {uploading && ' 上传中…'}
                      </p>
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    学生任务提示（可选）
                  </span>
                  <textarea
                    value={editingSlide.instruction || ''}
                    onChange={e =>
                      updateSlide(editingIndex!, {
                        instruction: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="填写本页对应的学生任务或操作提示（例如“小组讨论：…” 或“请在练习本上完成第 X 题”）。"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditingIndex(null)}
              >
                关闭
              </Button>
              <Button type="submit" size="sm">
                保存课件
              </Button>
            </div>
          </div>
        </div>
      )}

      <Button type="submit" size="sm" disabled={!slides.length}>
        保存课件
      </Button>
    </form>
  );
}
