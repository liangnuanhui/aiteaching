/**
 * LessonTabs
 * 课程详情页的水平 Tab 容器：
 * - 教案编辑
 * - 课件展示
 */

'use client';

import { useState } from 'react';

interface LessonTabsProps {
  edit: React.ReactNode;
  h5: React.ReactNode;
  works: React.ReactNode;
  initialTab?: 'edit' | 'h5' | 'works';
}

export function LessonTabs({ edit, h5, works, initialTab = 'edit' }: LessonTabsProps) {
  const [active, setActive] = useState<'edit' | 'h5' | 'works'>(initialTab);

  return (
    <div className="mt-4">
      <div className="flex border-b text-sm">
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
        <button
          type="button"
          onClick={() => setActive('works')}
          className={`mr-4 border-b-2 px-2 py-2 ${
            active === 'works'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          学生作品
        </button>
      </div>

      <div className="mt-4">
        {active === 'edit' && edit}
        {active === 'h5' && h5}
        {active === 'works' && works}
      </div>
    </div>
  );
}
