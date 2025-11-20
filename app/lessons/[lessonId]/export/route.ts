import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { Document, HeadingLevel, Packer, Paragraph } from 'docx';

export const runtime = 'nodejs';

type DocHeadingLevel = (typeof HeadingLevel)[keyof typeof HeadingLevel];

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ lessonId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { lessonId: lessonIdParam } = await context.params;
  const lessonId = Number(lessonIdParam ?? '');
  if (!lessonId || !Number.isFinite(lessonId)) {
    return new NextResponse('Invalid lesson id', { status: 400 });
  }

  const prisma = createPrismaClient();
  const userId = Number(session.user.id);

  const lesson = await prisma.lessonCard.findFirst({
    where: {
      id: lessonId,
      class: {
        teacherId: userId,
      },
    },
    include: {
      class: true,
    },
  });

  if (!lesson) {
    return new NextResponse('Lesson not found or no permission', { status: 404 });
  }

  const title = lesson.title || '教案';
  const className = lesson.class?.name || '';
  const gradeLevel = lesson.class?.gradeLevel || '';
  const headerText =
    className || gradeLevel
      ? `${title}-${className}${gradeLevel ? `（${gradeLevel}）` : ''}`
      : title;

  const md = lesson.mdPlan || '';
  const lines = md.split(/\r?\n/);

  const paragraphs: Paragraph[] = [];

  // 文档标题
  paragraphs.push(
    new Paragraph({
      text: headerText,
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({ text: '' })
  );

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }

    // 处理 Markdown 标题：# / ## / ### 等
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = stripInlineMarkdown(headingMatch[2]);

      let headingLevel: DocHeadingLevel = HeadingLevel.HEADING_3;
      if (level === 1) headingLevel = HeadingLevel.HEADING_1;
      else if (level === 2) headingLevel = HeadingLevel.HEADING_2;

      paragraphs.push(
        new Paragraph({
          text,
          heading: headingLevel,
        })
      );
      continue;
    }

    // 处理无序列表：- / * / +
    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bulletMatch) {
      const text = stripInlineMarkdown(bulletMatch[1]);
      paragraphs.push(
        new Paragraph({
          text: `• ${text}`,
        })
      );
      continue;
    }

    // 处理引用：> 开头
    const quoteMatch = trimmed.match(/^>\s+(.*)$/);
    if (quoteMatch) {
      const text = stripInlineMarkdown(quoteMatch[1]);
      paragraphs.push(
        new Paragraph({
          text: text,
        })
      );
      continue;
    }

    // 普通段落：移除常见 Markdown 行内语法
    const plain = stripInlineMarkdown(trimmed);
    paragraphs.push(new Paragraph({ text: plain }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const fileData = new Uint8Array(buffer);

  const filename = `${headerText}.docx`;
  const encodedFilename = encodeURIComponent(filename);

  return new NextResponse(fileData, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
    },
  });
}

/**
 * 粗略移除常见 Markdown 行内语法，避免在导出的 docx 中出现 ##、**、- 等符号。
 * 这里不追求完整 Markdown 还原，只是尽量为乡村教师生成干净可读的文档。
 */
function stripInlineMarkdown(input: string): string {
  let text = input;

  // 图片：![alt](url) -> alt
  text = text.replace(/!\[([^\]]*?)\]\([^)]+\)/g, '$1');

  // 链接：[label](url) -> label
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 粗体：**text** 或 __text__ -> text
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');

  // 斜体：*text* 或 _text_ -> text
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');

  // 行内代码：`code` -> code
  text = text.replace(/`([^`]+)`/g, '$1');

  // 多余的井号（非标题场景下残留）去掉左右空格
  text = text.replace(/(^|\s)#+(\s|$)/g, ' ');

  return text.trim();
}
