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

interface ParsedVideoUrl {
  platform: string;
  embedUrl: string;
  isSupported: boolean;
  needsIframe: boolean;
  message?: string;
}

function normalizeSlide(raw: unknown): Slide {
  if (!raw || typeof raw !== 'object') return {};

  const s = raw as RawSlide;

  const inferredType =
    s.type || (s.url ? (s.duration || s.mediaType === 'video' ? 'video' : 'image') : 'text');
  const normalizedUrl = getPersistentMediaUrl(s.url);

  return {
    type: inferredType,
    title: s.title,
    content: s.content,
    subtitle: s.subtitle,
    url: normalizedUrl ?? s.url,
    description: s.description,
    instruction: s.instruction,
  };
}

/**
 * 判断description是否为本地上传的文件名格式
 * 格式: 时间戳-原始文件名.扩展名 (如: 1763704682242-xxx.mp4)
 */
function isLocalUploadFilename(description: string): boolean {
  if (!description) return false;
  // 匹配以13位时间戳开头,后跟连字符和文件名的格式
  return /^\d{13}-.*\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg|mov|avi|flv|pdf)$/i.test(description);
}

function getPersistentMediaUrl(url?: string): string | undefined {
  if (!url) return undefined;

  // Already a local storage URL or remote CDN
  if (!url.includes('/api/upload')) {
    return url;
  }

  try {
    const parsed = new URL(
      url,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    );
    if (parsed.pathname === '/api/upload' && parsed.searchParams.has('key')) {
      const key = parsed.searchParams.get('key');
      if (key) {
        return `/api/storage/local/${key}`;
      }
    }
  } catch {
    // Fallback for cases like "/api/upload?key=xxx"
    const match = url.match(/key=([^&]+)/);
    if (match && match[1]) {
      return `/api/storage/local/${decodeURIComponent(match[1])}`;
    }
  }

  return url;
}

function parseVideoUrl(url?: string): ParsedVideoUrl {
  const normalized = getPersistentMediaUrl(url);
  if (!normalized) {
    return { platform: 'unknown', embedUrl: '', isSupported: false, needsIframe: false };
  }

  const cleanedUrl = normalized.trim();

  const biliMatch = cleanedUrl.match(/bilibili\.com\/video\/(BV[\w]+)/i);
  if (biliMatch) {
    return {
      platform: 'bilibili',
      embedUrl: `https://player.bilibili.com/player.html?bvid=${biliMatch[1]}&high_quality=1&autoplay=0`,
      isSupported: true,
      needsIframe: true,
    };
  }

  const ytMatch = cleanedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return {
      platform: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
      isSupported: true,
      needsIframe: true,
    };
  }

  const youkuMatch = cleanedUrl.match(/youku\.com\/.*\/id_([a-zA-Z0-9=]+)/);
  if (youkuMatch) {
    return {
      platform: 'youku',
      embedUrl: `https://player.youku.com/embed/${youkuMatch[1]}`,
      isSupported: true,
      needsIframe: true,
    };
  }

  const qqMatch = cleanedUrl.match(/v\.qq\.com\/.*\/([a-zA-Z0-9]+)\.html/);
  if (qqMatch) {
    return {
      platform: 'tencent',
      embedUrl: `https://v.qq.com/txp/iframe/player.html?vid=${qqMatch[1]}`,
      isSupported: true,
      needsIframe: true,
    };
  }

  if (cleanedUrl.includes('douyin.com')) {
    return {
      platform: 'douyin',
      embedUrl: cleanedUrl,
      isSupported: false,
      needsIframe: false,
      message: '抖音视频暂未开放嵌入，建议下载后再上传。',
    };
  }

  if (cleanedUrl.includes('xiaohongshu.com')) {
    return {
      platform: 'xiaohongshu',
      embedUrl: cleanedUrl,
      isSupported: false,
      needsIframe: false,
      message: '小红书视频暂未开放嵌入，建议下载后再上传。',
    };
  }

  if (cleanedUrl.match(/\.(mp4|webm|ogg|mov|avi|flv)(\?.*)?$/i)) {
    return {
      platform: 'direct',
      embedUrl: cleanedUrl,
      isSupported: true,
      needsIframe: false,
    };
  }

  return {
    platform: 'unknown',
    embedUrl: cleanedUrl,
    isSupported: false,
    needsIframe: false,
    message: '暂不支持该视频链接，请使用 B站 / YouTube / 优酷 / 腾讯视频 或上传文件。',
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
  const mediaUrl = getPersistentMediaUrl(current.url);
  const videoInfo = current.type === 'video' ? parseVideoUrl(mediaUrl) : null;

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

              {current.type === 'image' && mediaUrl ? (
                <div className="mt-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrl}
                    alt={current.description || current.title || '课件图片'}
                    className="mx-auto max-h-[60vh] rounded-md border border-border object-contain"
                  />
                  {/* 对于本地上传的图片(文件名格式),不显示description */}
                  {current.description && !isLocalUploadFilename(current.description) && (
                    <div className="mt-3 text-sm text-muted-foreground">{current.description}</div>
                  )}
                </div>
              ) : current.type === 'video' && mediaUrl ? (
                <div className="mt-4">
                  <div className="flex justify-center">
                    {videoInfo?.isSupported ? (
                      videoInfo.needsIframe ? (
                        <div className="w-full" style={{ width: 'min(90vw, 1400px)' }}>
                          <div
                            className="relative w-full overflow-hidden rounded-lg border border-border bg-black"
                            style={{ aspectRatio: '16 / 9' }}
                          >
                            <iframe
                              src={videoInfo.embedUrl}
                              title={current.title || '嵌入视频'}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="absolute inset-0 h-full w-full"
                            />
                          </div>
                        </div>
                      ) : (
                        <video
                          src={videoInfo.embedUrl}
                          controls
                          className="w-full rounded-lg border border-border bg-black"
                          style={{ width: 'min(90vw, 1200px)', maxHeight: '80vh' }}
                        />
                      )
                    ) : (
                      <div className="text-center text-sm text-destructive">
                        {videoInfo?.message ||
                          '视频链接暂不支持嵌入播放，请改用支持的平台或上传文件。'}
                      </div>
                    )}
                  </div>
                  {/* 对于本地上传的视频(文件名格式),不显示description */}
                  {current.description &&
                    videoInfo?.isSupported &&
                    !isLocalUploadFilename(current.description) && (
                      <div className="mt-3 text-center text-sm text-muted-foreground">
                        {current.description}
                      </div>
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
