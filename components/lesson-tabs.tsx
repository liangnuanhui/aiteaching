/**
 * LessonTabs
 * 课程详情页的水平 Tab 容器：
 * - 教案预览
 * - 教案编辑
 * - 课件展示
 */

'use client';

import { useState } from 'react';

interface LessonTabsProps {
  preview: React.ReactNode;
  edit: React.ReactNode;
  h5: React.ReactNode;
}

export function LessonTabs({ preview, edit, h5 }: LessonTabsProps) {
  const [active, setActive] = useState<'preview' | 'edit' | 'h5'>('preview');

  return (
    <div className="mt-4">
      <div className="flex border-b text-sm">
        <button
          type="button"
          onClick={() => setActive('preview')}
          className={`mr-4 border-b-2 px-2 py-2 ${
            active === 'preview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          教案预览
        </button>
        <button
          type="button"
          onClick={() => setActive('edit')}
          className={`mr-4 border-b-2 px-2 py-2 ${
            active === 'edit'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          教案编辑
        </button>
        <button
          type="button"
          onClick={() => setActive('h5')}
          className={`mr-4 border-b-2 px-2 py-2 ${
            active === 'h5'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          课件展示
        </button>
      </div>

      <div className="mt-4">
        {active === 'preview' && preview}
        {active === 'edit' && edit}
        {active === 'h5' && h5}
      </div>
    </div>
  );
}
