'use client';

import React, { useEffect, useRef, useState } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';

interface VditorEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  height?: string;
  readOnly?: boolean;
  className?: string;
}

export default function VditorEditor({
  value = '',
  onChange,
  height = '600px',
  readOnly = false,
  className = '',
}: VditorEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [vditor, setVditor] = useState<Vditor | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;

    // Initialize Vditor
    const editor = new Vditor(editorRef.current, {
      cache: {
        id: 'vditor-editor-demo', // ✅ 添加缓存ID，解决报错
      },
      mode: readOnly ? 'preview' : 'ir', // ✅ IR模式 = 即时渲染（隐藏Markdown符号）
      value,
      height,
      lang: 'zh_CN',
      theme: 'classic',
      icon: 'ant',
      toolbar: [
        'emoji',
        'headings',
        'bold',
        'italic',
        'strike',
        '|',
        'list',
        'ordered-list',
        'check',
        'quote',
        'code',
        'table',
        'link',
        '|',
        'undo',
        'redo',
        'fullscreen',
        {
          name: 'preview',
          tip: '预览模式',
        },
      ],
      toolbarConfig: {
        pin: true,
      },
      preview: {
        delay: 0,
      },
      input: (newValue: string) => {
        onChange?.(newValue);
      },
      after: () => {
        setIsReady(true);
        console.log('Vditor IR 模式已加载完成');
      },
    });

    setVditor(editor);

    // Cleanup
    return () => {
      try {
        editor.destroy();
      } catch (e) {
        console.warn('Vditor cleanup warning:', e);
      }
    };
  }, []);

  // Sync value changes from props
  useEffect(() => {
    if (vditor && isReady) {
      const currentValue = vditor.getValue();
      if (currentValue !== value) {
        vditor.setValue(value);
      }
    }
  }, [value, vditor, isReady]);

  return (
    <div className={`relative ${className}`}>
      {!isReady && (
        <div className="flex h-64 items-center justify-center border rounded-md bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <span className="text-sm text-muted-foreground">正在加载编辑器...</span>
          </div>
        </div>
      )}
      <div ref={editorRef} style={{ height }} className="vditor-container" />
    </div>
  );
}
