# Vditor IR 模式集成指南

## 🎯 目标

为乡村教师提供所见即所得的教案编辑体验，完全隐藏 Markdown 语法符号（##、\*\*、- 等），降低使用门槛。

## 📦 快速开始

### 1. 安装依赖

```bash
pnpm add vditor
```

### 2. 集成到课程详情页

在 `app/lessons/[lessonId]/page.tsx` 中替换原有的编辑器：

```tsx
// 替换前：原始Markdown显示
// app/lessons/[lessonId]/page.tsx

// app/lessons/[lessonId]/page.tsx:113-114
<CardContent>
  <LessonPlanEditor lessonId={lesson.id} initialMdPlan={lesson.mdPlan} />
</CardContent>

// 替换为：
<CardContent className="p-0">
  <VditorEditor
    value={lesson.mdPlan}
    onChange={(newValue) => {
      // 自动保存逻辑
      autosave(newValue);
    }}
    height="600px"
  />
</CardContent>
```

### 3. 自动保存功能

可以在 VditorEditor 组件中集成自动保存：

```tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import { autosaveLessonPlan } from '@/app/actions/lessons';
import { debounce } from 'lodash-es';

interface VditorEditorProps {
  value?: string;
  lessonId: number;
  height?: string;
}

export default function VditorEditor({
  value = '',
  lessonId,
  height = '600px',
}: VditorEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  // 自动保存函数（防抖）
  const handleAutosave = debounce(async (newValue: string) => {
    const formData = new FormData();
    formData.append('lessonId', lessonId.toString());
    formData.append('mdPlan', newValue);
    await autosaveLessonPlan(formData);
    console.log('自动保存完成');
  }, 2000); // 2秒防抖

  useEffect(() => {
    if (!editorRef.current) return;

    // 强制隐藏 Markdown 语法
    const customCss = `
      .vditor-ir .vditor-ir__node[data-type="code-block"] {
        color: inherit;
      }
      .vditor-ir .vditor-ir__node[data-type="code-block"] .vditor-ir__marker {
        display: none !important;
      }
    `;

    const editor = new Vditor(editorRef.current, {
      mode: 'ir', // ✅ IR模式 = 即时渲染（隐藏Markdown符号）
      value,
      height,
      lang: 'zh_CN',
      theme: 'classic',
      icon: 'ant',
      toolbar: [
        'emoji', // 表情符号
        'headings', // 标题
        'bold', // 加粗
        'italic', // 斜体
        'strike', // 删除线
        '|',
        'list', // 无序列表
        'ordered-list', // 有序列表
        'check', // 任务列表
        'quote', // 引用
        'code', // 代码块
        'table', // 表格
        'link', // 链接
        '|',
        'undo', // 撤销
        'redo', // 重做
        'fullscreen', // 全屏
        'preview', // 预览
      ],
      toolbarConfig: {
        pin: true, // 工具栏固定在顶部
      },
      preview: {
        delay: 0,
      },
      input: (newValue: string) => {
        // 自动保存
        handleAutosave(newValue);
      },
      after: () => {
        setIsReady(true);
        console.log('Vditor IR 模式已加载');
      },
    });

    return () => {
      try {
        editor.destroy();
      } catch (e) {
        console.warn('Vditor cleanup warning:', e);
      }
    };
  }, [lessonId]);

  return (
    <div className="relative">
      {!isReady && (
        <div className="flex h-64 items-center justify-center border rounded-md bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <span className="text-sm text-muted-foreground">正在加载编辑器...</span>
          </div>
        </div>
      )}
      <div ref={editorRef} className="vditor-container" />
    </div>
  );
}
```

## 🔧 配置说明

### IR 模式的关键特性

| 特性             | 说明                               | 优势                 |
| ---------------- | ---------------------------------- | -------------------- |
| **即时渲染**     | 输入时立即显示渲染效果             | 所见即所得，无需预览 |
| **隐藏语法**     | Markdown 符号（##、\*\*、-）不可见 | 教师无需学习标记语言 |
| **类 Word 体验** | 类似 Microsoft Word 的编辑界面     | 零学习成本           |
| **实时保存**     | 内容变化自动触发保存               | 防止数据丢失         |

### 工具栏功能

```tsx
toolbar: [
  'emoji', // 表情符号，丰富内容表达
  'headings', // 标题（H1-H6）
  'bold', // 加粗
  'italic', // 斜体
  'strike', // 删除线
  '|', // 分隔符
  'list', // 无序列表（点击按钮生成，不显示 - ）
  'ordered-list', // 有序列表
  'check', // 任务列表（复选框）
  'quote', // 引用块
  'code', // 代码块
  'table', // 插入表格
  'link', // 超链接
  '|', // 分隔符
  'undo', // 撤销
  'redo', // 重做
  'fullscreen', // 全屏编辑
  'preview', // 预览模式
];
```

## 🧪 测试演示

访问演示页面查看效果：

```bash
# 启动开发服务器
pnpm dev

# 打开浏览器访问
http://localhost:3000/vditor-demo
```

演示页面包含：

- ✅ 实时编辑器体验
- ✅ 对比展示（Markdown vs IR 模式）
- ✅ 功能特性说明
- ✅ 快速集成步骤

在演示页面中可以直观体验：

- 标题（#）不显示 #，直接显示为标题样式
- 加粗（**）不显示 **，文字直接加粗
- 列表（-）不显示 -，直接显示为列表项

## 💡 使用建议

### 对于乡村教师

- 无需学习 Markdown 语法
- 像使用 Word 一样编辑教案
- 所见即所得，编辑效果 = 展示效果

### 对于开发者

- 数据存储格式仍为 Markdown，便于版本管理和导出
- 编辑器配置简洁，易于维护
- 支持自定义皮肤和工具栏

### 性能优化

- Vditor 核心 < 100KB，加载快速
- 支持懒加载，首屏无需加载编辑器
- 网络环境差的地区也能流畅使用

## 📱 移动端支持

Vditor 支持移动端编辑：

- 响应式布局适配不同屏幕
- 移动端工具栏自动调整
- 触摸友好的交互设计

## 🔗 相关文档

- [Vditor 官方文档](https://github.com/Vanessa219/vditor)
- [Vditor 配置选项](https://github.com/Vanessa219/vditor/blob/master/README_zh_CN.md)

## ❓ 常见问题

### Q: IR 模式和预览模式的区别？

**A:**

- IR 模式（Instant Rendering）：实时渲染，Markdown 符号不可见，适合编辑
- 预览模式：显示渲染后的 HTML，不可编辑，适合查看最终效果

### Q: 是否支持图片上传？

**A:** 支持，需要配置 `upload` 参数，可以对接 R2、S3 等对象存储服务

### Q: 如何限制编辑器高度？

**A:** 通过 `height` 参数设置，支持 px、vh、% 等单位

### Q: 是否支持自定义样式？

**A:** 支持，可以通过 `theme` 参数或注入自定义 CSS 实现
