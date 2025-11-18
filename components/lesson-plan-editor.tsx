/**
 * LessonPlanEditor
 * 教案编辑组件：
 * - 为老师提供简单的结构化表单（教学目标、重难点、步骤等）
 * - 同时保留“高级模式”原始 Markdown 文本编辑
 * - 提交时：
 *   - 如果结构化表单有内容，则按模板生成新的 Markdown
 *   - 否则使用高级模式文本作为 mdPlan
 */

'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateLessonPlan } from '@/app/actions/lessons';

interface LessonPlanEditorProps {
  lessonId: number;
  initialMdPlan: string | null;
}

interface ParsedSections {
  goals: string;
  keyPoints: string;
  prep: string;
  steps: string;
  activities: string;
  summary: string;
}

function parseInitialMdPlan(md: string | null): ParsedSections {
  const empty: ParsedSections = {
    goals: '',
    keyPoints: '',
    prep: '',
    steps: '',
    activities: '',
    summary: '',
  };

  if (!md) return empty;

  const lines = md.split(/\r?\n/);
  const sections: ParsedSections = { ...empty };

  type SectionKey = keyof ParsedSections;
  let current: SectionKey | null = null;

  const setCurrentFromHeading = (line: string) => {
    const text = line.trim();
    if (!text.startsWith('##')) return;

    const normalized = text.replace(/^#+\s*/, '');

    const mapping: { key: SectionKey; match: RegExp }[] = [
      {
        key: 'goals',
        match: /^(一|1)[、.．\s]*教学目标/,
      },
      {
        key: 'keyPoints',
        match: /^(二|2)[、.．\s]*(教学重难点|重难点)/,
      },
      {
        key: 'prep',
        match: /^(三|3)[、.．\s]*(课前准备|教学准备)/,
      },
      {
        key: 'steps',
        match: /^(四|4)[、.．\s]*(详细教学步骤|教学步骤)/,
      },
      {
        key: 'activities',
        match: /^(五|5)[、.．\s]*(互动活动设计|活动设计|课堂活动)/,
      },
      {
        key: 'summary',
        match: /^(六|6)[、.．\s]*(课堂总结与教学反思|课堂总结|教学反思)/,
      },
    ];

    for (const item of mapping) {
      if (item.match.test(normalized)) {
        current = item.key;
        return;
      }
    }

    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('##')) {
      setCurrentFromHeading(trimmed);
      continue;
    }

    if (current) {
      sections[current] += (sections[current] ? '\n' : '') + line;
    }
  }

  return sections;
}

export function LessonPlanEditor({ lessonId, initialMdPlan }: LessonPlanEditorProps) {
  const initialSections = useMemo(() => parseInitialMdPlan(initialMdPlan), [initialMdPlan]);

  const [goals, setGoals] = useState(initialSections.goals);
  const [keyPoints, setKeyPoints] = useState(initialSections.keyPoints);
  const [prep, setPrep] = useState(initialSections.prep);
  const [steps, setSteps] = useState(initialSections.steps);
  const [activities, setActivities] = useState(initialSections.activities);
  const [summary, setSummary] = useState(initialSections.summary);

  const [rawMd, setRawMd] = useState(initialMdPlan ?? '');

  const structuredDirty = useMemo(
    () =>
      !!(
        goals.trim() !== (initialSections.goals || '').trim() ||
        keyPoints.trim() !== (initialSections.keyPoints || '').trim() ||
        prep.trim() !== (initialSections.prep || '').trim() ||
        steps.trim() !== (initialSections.steps || '').trim() ||
        activities.trim() !== (initialSections.activities || '').trim() ||
        summary.trim() !== (initialSections.summary || '').trim()
      ),
    [goals, keyPoints, prep, steps, activities, summary, initialSections]
  );

  function buildMarkdownFromStructured(): string {
    return [
      '## 一、教学目标',
      goals || '（在此填写教学目标，如：认知目标、能力目标、情感目标等）',
      '',
      '## 二、教学重难点',
      keyPoints || '（在此说明本课的重点和难点）',
      '',
      '## 三、课前准备',
      prep || '（在此列出课前需要准备的教具、材料和学生预习内容）',
      '',
      '## 四、教学步骤',
      steps || '（按“导入—展开—巩固—总结”的结构分段描述，每段写出教师活动和学生活动）',
      '',
      '## 五、互动活动设计',
      activities || '（在此设计 1–2 个适合本年级学生的互动活动）',
      '',
      '## 六、课堂总结与教学反思',
      summary || '（在此写课堂总结和课后反思提示）',
      '',
    ].join('\n');
  }

  const mdToSubmit = useMemo(
    () => (structuredDirty ? buildMarkdownFromStructured() : rawMd),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structuredDirty, goals, keyPoints, prep, steps, activities, summary, rawMd]
  );

  return (
    <form action={updateLessonPlan} className="space-y-4">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="mdPlan" value={mdToSubmit} />

      <div className="space-y-2 rounded-md border bg-muted/40 p-3">
        <div className="text-sm font-medium">结构化编辑（推荐）</div>
        <p className="text-xs text-muted-foreground">
          上面的内容已经按照常见教案结构自动拆分成几个部分。只有当你修改这些字段时，
          系统才会根据结构化内容自动生成新的教案；如果不修改或只在下方“高级模式”中编辑完整文本，则以完整文本为准。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="goals" className="text-sm font-medium">
              教学目标
            </label>
            <textarea
              id="goals"
              value={goals}
              onChange={e => setGoals(e.target.value)}
              rows={4}
              placeholder="例如：\n1. 让学生懂得什么是真正的友谊；\n2. 学会在班级中与同学友好相处。"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="keyPoints" className="text-sm font-medium">
              教学重难点
            </label>
            <textarea
              id="keyPoints"
              value={keyPoints}
              onChange={e => setKeyPoints(e.target.value)}
              rows={3}
              placeholder="例如：\n重点：通过故事和活动理解友谊的含义；\n难点：引导学生反思日常相处中的问题。"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="prep" className="text-sm font-medium">
              课前准备
            </label>
            <textarea
              id="prep"
              value={prep}
              onChange={e => setPrep(e.target.value)}
              rows={3}
              placeholder="例如：多媒体课件、故事视频、便利贴、分组卡片等。"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="steps" className="text-sm font-medium">
              教学步骤
            </label>
            <textarea
              id="steps"
              value={steps}
              onChange={e => setSteps(e.target.value)}
              rows={6}
              placeholder="建议按导入—展开—巩固—总结分段写：\n【导入】教师活动：… 学生活动：…\n【活动一】……\n【活动二】……"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="activities" className="text-sm font-medium">
              互动活动设计
            </label>
            <textarea
              id="activities"
              value={activities}
              onChange={e => setActivities(e.target.value)}
              rows={4}
              placeholder="例如：\n活动一：友谊采访——学生两人一组互相采访；\n活动二：写给朋友的一句话。"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="summary" className="text-sm font-medium">
              课堂总结与教学反思
            </label>
            <textarea
              id="summary"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={3}
              placeholder="例如：\n课堂总结：学生说一说今天最大的收获；\n教学反思：哪些环节学生最积极？哪些地方下次可以改进？"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-md border bg-muted/40 p-3">
        <div className="text-sm font-medium">高级模式：直接编辑完整教案（可选）</div>
        <p className="text-xs text-muted-foreground">
          如果你更习惯一次性修改完整教案，可以在下面直接编辑文本。只有在上面的结构化表单全部留空时，系统才会使用这里的内容。
        </p>
        <textarea
          value={rawMd}
          onChange={e => setRawMd(e.target.value)}
          rows={10}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="这里显示的是当前完整教案的 Markdown 文本，你可以在此基础上进行修改。"
        />
      </div>

      <Button type="submit" size="sm">
        保存教案修改
      </Button>
    </form>
  );
}
