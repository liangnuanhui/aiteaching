/**
 * VditorEditor
 * 使用 Vditor IR 模式提供所见即所得的教案编辑体验。
 * 数据持久化通过底部“保存教案”按钮调用 server action 完成；
 * 本地编辑过程由 Vditor 自带缓存负责，防止刷新时丢稿。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import { Button } from '@/components/ui/button';
import { updateLessonPlan } from '@/app/actions/lessons';

interface VditorEditorProps {
  lessonId: number;
  value?: string | null;
  height?: string;
}

export function VditorEditor({ lessonId, value = '', height = '600px' }: VditorEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentValue, setCurrentValue] = useState<string>(value || '');

  useEffect(() => {
    if (!editorRef.current) return;

    const el = editorRef.current;

    const editor = new Vditor(el, {
      mode: 'ir', // 即时渲染模式，隐藏 Markdown 符号
      value: value || '',
      height,
      lang: 'zh_CN',
      theme: 'classic',
      icon: 'ant',
      toolbar: [
        'headings',
        'bold',
        'italic',
        'strike',
        '|',
        'list',
        'ordered-list',
        'check',
        'quote',
        '|',
        'table',
        'link',
        '|',
        'undo',
        'redo',
        'fullscreen',
        'preview',
      ],
      toolbarConfig: {
        pin: true,
      },
      cache: {
        enable: true,
        id: `lesson-${lessonId}-plan`,
      },
      preview: {
        delay: 0,
      },
      input: (newValue: string) => {
        // 记录当前编辑内容，用于提交到服务器
        setCurrentValue(newValue);
      },
      after: () => {
        setIsReady(true);
      },
    });

    return () => {
      try {
        editor.destroy();
      } catch {
        // ignore
      }
    };
  }, [height, lessonId, value]);

  return (
    <form action={updateLessonPlan} className="space-y-3">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="mdPlan" value={currentValue} />

      {!isReady && (
        <div className="flex h-64 items-center justify-center rounded-md border bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">正在加载编辑器...</span>
          </div>
        </div>
      )}

      <div ref={editorRef} />

      <div className="flex justify-end">
        <Button type="submit" size="sm">
          保存教案
        </Button>
      </div>
    </form>
  );
}
