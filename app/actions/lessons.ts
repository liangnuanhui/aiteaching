/**
 * LessonCard Management Server Actions
 * Server-side actions for managing lesson cards in a class
 */

'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { deleteFile } from '@/lib/storage';
import { tableExists } from '@/lib/db/utils';
import { ClassRepository, LessonCardRepository } from '@/repositories';
import { callModelScopeChat, getMessageContentText } from '@/lib/modelscope/client';

/**
 * Create a new lesson card under a class owned by the current user
 * (Server Action, used在班级详情页表单)
 */
export async function createLesson(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/classes');
  }

  const classIdValue = formData.get('classId');
  const titleValue = formData.get('title');

  const classId = Number(classIdValue ?? '');
  const title = (titleValue ?? '').toString().trim();

  console.log('[createLesson] start', {
    classIdValue,
    title,
    userId: session.user.id,
  });

  if (!classId || !Number.isFinite(classId)) {
    throw new Error('Invalid class id');
  }

  if (!title) {
    throw new Error('Lesson title is required');
  }

  const userId = Number(session.user.id);
  const prisma = createPrismaClient();
  const classRepo = new ClassRepository(prisma);
  const lessonRepo = new LessonCardRepository(prisma);

  const cls = await classRepo.findById(classId);

  if (!cls || cls.teacherId !== userId) {
    throw new Error('You do not have permission to modify this class');
  }

  // Call LLM to generate lesson content (Markdown) based on grade level and topic
  let mdPlan = '';
  let h5Json = '{}';

  try {
    const grade = cls.gradeLevel || '小学';
    const systemPrompt = `### "心灵微光"首席教育专家 (Prompt v1.7)

你是一名融合了班主任、心理健康老师和教案设计专家于一身的“AI副班主任”，服务对象是乡村 ${grade} 老师。

核心原则：
- 严格分层适配：所有内容必须符合 ${grade} 学生的认知水平。
- 聚焦班会课、心理课、德育课等非学科课程。
- 产出结构化、可直接用于课堂和电子白板展示的教案和课件。`;

    const userPrompt = [
      `**当前任务：** 为 **${grade}** 学生设计一节「${title}」课程（班会 / 心理 / 德育方向）`,
      '',
      '**Self-Correction (内部思考)：**',
      '1. 先思考本年级学生的认知特点和班级常见问题；',
      '2. 再把“课程主题”具体化为学生听得懂的语言；',
      '3. 选择 2–3 个适合本年级的活动形式（游戏、故事、讨论、角色扮演等）。',
      '',
      '**产出要求：**',
      '你必须一次性按下面的格式输出三个部分：',
      '',
      '1. 课程标题（10字以内，简洁有力）',
      '2. H5 演示数据包（JSON），用于课堂幻灯片放映',
      '3. 详细教案（Markdown），方便教师备课与打印',
      '',
      '**输出格式（严格遵守，下方代码块必须完整）：**',
      '',
      '```title',
      '课程标题（10字以内）',
      '```',
      '',
      '```json',
      '{',
      '  "h5_data": {',
      '    "slides": [',
      '      {',
      '        "type": "title",',
      '        "title": "课程标题",',
      '        "subtitle": "年级或副标题（可选）"',
      '      },',
      '      {',
      '        "type": "text",',
      '        "title": "环节标题",',
      '        "content": "用于投影的课堂讲解文本",',
      '        "note": "教师引导语（可选）"',
      '      },',
      '      {',
      '        "type": "activity",',
      '        "title": "活动名称",',
      '        "content": "活动步骤与说明",',
      '        "instruction": "学生需要做什么" ',
      '      },',
      '      {',
      '        "type": "image",',
      '        "title": "图片展示",',
      '        "url": "图片URL占位符",',
      '        "description": "图片说明文本"',
      '      },',
      '      {',
      '        "type": "summary",',
      '        "title": "课堂小结",',
      '        "content": "本课要点总结",',
      '        "keypoints": ["要点1", "要点2"]',
      '      }',
      '    ]',
      '  }',
      '}',
      '```',
      '',
      '```markdown',
      `# ${grade}德育课教案：[课程标题]`,
      '',
      '## 一、教学目标',
      '1. 认知目标：…',
      '2. 能力目标：…',
      '3. 情感目标：…',
      '',
      '## 二、教学重难点',
      '**重点：** …',
      '',
      '## 三、课前准备',
      '- 教具材料：…',
      '- 学生准备：…',
      '',
      '## 四、详细教学步骤',
      '',
      '### 环节一：导入（5分钟）',
      '**教师活动：** …',
      '',
      '**学生活动：** …',
      '',
      '### 环节二：展开（20分钟）',
      '…',
      '',
      '### 环节三：总结与延伸（10分钟）',
      '…',
      '',
      '## 五、互动活动设计',
      '### 活动一：[活动名称]',
      '**活动目标：** …',
      '',
      '## 六、课堂总结与教学反思',
      '…',
      '```',
      '',
      '请务必严格按照上述三个代码块顺序输出（title → json → markdown），不要添加其它无关内容。若你认为某些部分不适用，也请用中文说明原因而不要省略结构。',
    ].join('\n');

    const llmStart = Date.now();
    console.log('[createLesson] calling ModelScope LLM');

    const result = await callModelScopeChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        model: 'Qwen/Qwen3-Next-80B-A3B-Thinking',
      }
    );

    console.log('[createLesson] ModelScope LLM finished in ms', Date.now() - llmStart);

    const content = getMessageContentText(result.choices[0]?.message.content);

    // Extract title
    const titleMatch = content.match(/```title\s*([\s\S]*?)```/);
    const extractedTitle = titleMatch ? titleMatch[1].trim() : '';

    // Extract JSON part
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1].trim() : '';

    // Extract markdown part
    const mdMatch = content.match(/```markdown\s*([\s\S]*?)```/);
    const extractedMd = mdMatch ? mdMatch[1].trim() : content;

    mdPlan = extractedMd;

    if (jsonText) {
      try {
        // Validate JSON
        const parsed = JSON.parse(jsonText);
        h5Json = JSON.stringify(parsed, null, 2);
      } catch (e) {
        console.error('Failed to parse H5 JSON from LLM, falling back to simple slides:', e);
        h5Json = JSON.stringify(
          {
            title: extractedTitle || title,
            grade,
            generatedAt: new Date().toISOString(),
            sections: [
              {
                type: 'markdown',
                content: mdPlan,
              },
            ],
          },
          null,
          2
        );
      }
    } else {
      // No JSON block, simple fallback
      h5Json = JSON.stringify(
        {
          title: extractedTitle || title,
          grade,
          generatedAt: new Date().toISOString(),
          sections: [
            {
              type: 'markdown',
              content: mdPlan,
            },
          ],
        },
        null,
        2
      );
    }
  } catch (error) {
    // If LLM call fails, still create an empty lesson card so teachers can edit later
    console.error('Failed to generate lesson content via ModelScope:', error);
    mdPlan = '';
    h5Json = JSON.stringify(
      {
        title,
        generatedAt: new Date().toISOString(),
        sections: [],
        error: 'AI教案生成失败，请手动编辑或稍后重试。',
      },
      null,
      2
    );
  }

  console.log('[createLesson] creating lesson record in database');

  const lesson = await lessonRepo.create({
    title,
    classId,
    h5Json,
    mdPlan,
  });

  console.log('[createLesson] lesson created with id', lesson.id);

  redirect(`/lessons/${lesson.id}`);
}

/**
 * Update lesson markdown plan (teacher manual edits)
 */
export async function updateLessonPlan(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const lessonIdValue = formData.get('lessonId');
  const mdPlanValue = formData.get('mdPlan');

  const lessonId = Number(lessonIdValue ?? '');
  const mdPlan = (mdPlanValue ?? '').toString();

  if (!lessonId || !Number.isFinite(lessonId)) {
    throw new Error('Invalid lesson id');
  }

  const userId = Number(session.user.id);
  const prisma = createPrismaClient();

  const lesson = await prisma.lessonCard.findFirst({
    where: {
      id: lessonId,
      class: {
        teacherId: userId,
      },
    },
  });

  if (!lesson) {
    throw new Error('Lesson not found or you do not have permission to edit it');
  }

  await prisma.lessonCard.update({
    where: { id: lesson.id },
    data: {
      mdPlan,
      updatedAt: Math.floor(Date.now() / 1000),
    },
  });

  redirect(`/lessons/${lesson.id}?tab=edit#lesson-edit`);
}

/**
 * Update lesson markdown plan without redirect (for autosave)
 */
export async function autosaveLessonPlan(input: { lessonId: number; mdPlan: string }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const lessonId = Number(input.lessonId ?? '');
  const mdPlan = (input.mdPlan ?? '').toString();

  if (!lessonId || !Number.isFinite(lessonId)) {
    throw new Error('Invalid lesson id');
  }

  const userId = Number(session.user.id);
  const prisma = createPrismaClient();

  const lesson = await prisma.lessonCard.findFirst({
    where: {
      id: lessonId,
      class: {
        teacherId: userId,
      },
    },
  });

  if (!lesson) {
    throw new Error('Lesson not found or you do not have permission to edit it');
  }

  await prisma.lessonCard.update({
    where: { id: lesson.id },
    data: {
      mdPlan,
      updatedAt: Math.floor(Date.now() / 1000),
    },
  });
}

/**
 * Update lesson H5 JSON (slides / media)
 */
export async function updateLessonH5(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const lessonIdValue = formData.get('lessonId');
  const h5JsonValue = formData.get('h5Json');

  const lessonId = Number(lessonIdValue ?? '');
  const h5Json = (h5JsonValue ?? '').toString() || '{}';

  if (!lessonId || !Number.isFinite(lessonId)) {
    throw new Error('Invalid lesson id');
  }

  // Basic validation: ensure h5Json is valid JSON
  try {
    JSON.parse(h5Json);
  } catch {
    throw new Error('Invalid H5 JSON payload');
  }

  const userId = Number(session.user.id);
  const prisma = createPrismaClient();

  const lesson = await prisma.lessonCard.findFirst({
    where: {
      id: lessonId,
      class: {
        teacherId: userId,
      },
    },
  });

  if (!lesson) {
    throw new Error('Lesson not found or you do not have permission to edit it');
  }

  await prisma.lessonCard.update({
    where: { id: lesson.id },
    data: {
      h5Json,
      updatedAt: Math.floor(Date.now() / 1000),
    },
  });

  redirect(`/lessons/${lesson.id}?tab=h5`);
}

/**
 * Update lesson status (e.g. draft -> ready)
 */
export async function updateLessonStatus(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const lessonIdValue = formData.get('lessonId');
  const statusValue = formData.get('status');

  const lessonId = Number(lessonIdValue ?? '');
  const status = (statusValue ?? '').toString();

  if (!lessonId || !Number.isFinite(lessonId)) {
    throw new Error('Invalid lesson id');
  }

  if (!status) {
    throw new Error('Invalid status');
  }

  const userId = Number(session.user.id);
  const prisma = createPrismaClient();

  const lesson = await prisma.lessonCard.findFirst({
    where: {
      id: lessonId,
      class: {
        teacherId: userId,
      },
    },
  });

  if (!lesson) {
    throw new Error('Lesson not found or you do not have permission to update it');
  }

  await prisma.lessonCard.update({
    where: { id: lesson.id },
    data: {
      status,
      updatedAt: Math.floor(Date.now() / 1000),
    },
  });

  redirect(`/lessons/${lesson.id}`);
}

/**
 * Delete a lesson card owned by the current user
 */
export async function deleteLesson(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const lessonIdValue = formData.get('lessonId');
  const lessonId = Number(lessonIdValue ?? '');

  if (!lessonId || !Number.isFinite(lessonId)) {
    throw new Error('Invalid lesson id');
  }

  const userId = Number(session.user.id);
  const prisma = createPrismaClient();

  // Ensure the lesson belongs to the current teacher
  const lesson = await prisma.lessonCard.findFirst({
    where: {
      id: lessonId,
      class: {
        teacherId: userId,
      },
    },
  });

  if (!lesson) {
    throw new Error('Lesson not found or you do not have permission to delete it');
  }

  const uploads = await prisma.upload.findMany({
    where: { lessonId: lesson.id },
    select: {
      filePath: true,
    },
  });

  const reportTableExists = await tableExists(prisma, 'reports');

  await prisma.$transaction(async tx => {
    if (reportTableExists) {
      await tx.report.deleteMany({ where: { lessonId: lesson.id } });
    }
    await tx.upload.deleteMany({ where: { lessonId: lesson.id } });
    await tx.lessonCard.delete({ where: { id: lesson.id } });
  });

  await Promise.all(
    uploads.map(async upload => {
      if (!upload.filePath) return;
      try {
        await deleteFile(upload.filePath);
      } catch (error) {
        console.error(`Failed to delete file ${upload.filePath}:`, error);
      }
    })
  );

  redirect('/dashboard');
}
