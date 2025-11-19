/**
 * LessonH5Player
 * 根据 h5Json 展示课件预览 + 全屏放映。
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

export interface Slide {
  type?: string;
  title?: string;
  content?: string;
  subtitle?: string;
  url?: string;
  description?: string;
  instruction?: string;
}

interface LessonH5PlayerProps {
  h5Json: string | null;
  showPreviewGrid?: boolean;
}

type RawSlide = {
  type?: string;
  title?: string;
  content?: string;
  subtitle?: string;
  url?: string;
  description?: string;
  instruction?: string;
  duration?: string | number;
  mediaType?: string;
};

function normalizeSlide(raw: unknown): Slide {
  if (!raw || typeof raw !== 'object') return {};

  const s = raw as RawSlide;

  const inferredType =
    s.type || (s.url ? (s.duration || s.mediaType === 'video' ? 'video' : 'image') : 'text');

  return {
    type: inferredType,
    title: s.title,
    content: s.content,
    subtitle: s.subtitle,
    url: s.url,
    description: s.description,
    instruction: s.instruction,
  };
}

export function parseSlides(h5Json: string | null): Slide[] {
  if (!h5Json) return [];
  try {
    const data = JSON.parse(h5Json);

    // 兼容旧格式：h5_data.slides
    if (data.h5_data && Array.isArray(data.h5_data.slides)) {
      return data.h5_data.slides.map(normalizeSlide);
    }

    // 新格式：sections（用于兜底）
    if (Array.isArray(data.sections)) {
      return data.sections.map(normalizeSlide);
    }
  } catch {
    return [];
  }
  return [];
}

export function LessonH5Player({ h5Json, showPreviewGrid = true }: LessonH5PlayerProps) {
  const slides = useMemo(() => parseSlides(h5Json), [h5Json]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setIndex(prev => (prev + 1 < slides.length ? prev + 1 : prev));
      } else if (e.key === 'ArrowLeft') {
        setIndex(prev => (prev - 1 >= 0 ? prev - 1 : prev));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsPlaying(false);
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
    }

    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        setIsPlaying(false);
      }
    }

    window.addEventListener('keydown', handleKey);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // 尝试进入全屏
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }

    return () => {
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isPlaying, slides.length]);

  if (!slides.length) {
    return <p className="text-sm text-muted-foreground">当前课程暂未生成可用的 H5 课件数据。</p>;
  }

  const current = slides[index] || {};

  return (
    <>
      <div className="space-y-3">
        <Button type="button" size="sm" onClick={() => setIsPlaying(true)}>
          开始课件展示
        </Button>
        {showPreviewGrid && (
          <div className="grid gap-2 md:grid-cols-3">
            {slides.map((slide, i) => (
              <div
                key={i}
                className="rounded-md border border-dashed border-border bg-muted px-3 py-2 text-xs"
              >
                <div className="font-medium">
                  第 {i + 1} 页 · {slide.title || slide.type || '内容'}
                </div>
                <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-muted-foreground">
                  {slide.type === 'image'
                    ? '图片：' + (slide.description || '点击进入放映查看')
                    : slide.type === 'video'
                      ? '视频：' + (slide.description || '点击进入放映查看')
                      : slide.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isPlaying && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white text-foreground">
          <div className="flex items-center justify-between px-6 py-3 text-sm">
            <div>
              第 {index + 1} / {slides.length} 页
            </div>
            <div className="space-x-3">
              <span className="hidden md:inline-block text-xs text-muted-foreground">
                使用 ← → 或空格键切换，Esc 退出
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => {
                  setIsPlaying(false);
                  if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                  }
                }}
              >
                退出放映
              </Button>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center px-8 pb-10">
            <div className="max-w-4xl whitespace-pre-wrap text-center text-lg leading-relaxed">
              {current.title && <div className="mb-4 text-2xl font-semibold">{current.title}</div>}
              {current.subtitle && (
                <div className="mb-4 text-base text-muted-foreground">{current.subtitle}</div>
              )}

              {current.type === 'image' && current.url ? (
                <div className="mt-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.url}
                    alt={current.description || current.title || '课件图片'}
                    className="mx-auto max-h-[60vh] rounded-md border border-border object-contain"
                  />
                  {current.description && (
                    <div className="mt-3 text-sm text-muted-foreground">{current.description}</div>
                  )}
                </div>
              ) : current.type === 'video' && current.url ? (
                <div className="mt-4 flex justify-center">
                  <video
                    src={current.url}
                    controls
                    className="max-h-[60vh] w-full max-w-3xl rounded-md border border-border bg-black"
                  />
                  {current.description && (
                    <div className="mt-3 text-sm text-muted-foreground">{current.description}</div>
                  )}
                </div>
              ) : (
                <div className="text-left text-base">
                  {current.content}
                  {current.instruction && (
                    <div className="mt-4 text-sm text-muted-foreground">
                      学生任务：{current.instruction}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
