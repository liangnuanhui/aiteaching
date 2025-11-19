/**
 * Report Generator Service
 * Generates AI-powered analysis reports for student works
 */

import type { PrismaClient } from '@prisma/client';
import { callModelScopeChat } from '@/lib/modelscope/client';

/**
 * Aggregated statistics
 */
interface AggregatedStats {
  totalWorks: number;
  byType: Record<string, number>;
  byEmotion: Record<string, number>;
  topKeywords: string[];
  studentStats: Array<{
    studentId: number;
    studentName: string;
    count: number;
    types: string[];
  }>;
}

/**
 * Report Generator
 */
export class ReportGenerator {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate class report for a lesson
   *
   * @param lessonId - Lesson ID
   * @returns Generated report in Markdown format
   */
  async generateClassReport(lessonId: number): Promise<string> {
    // 1. Get confirmed uploads
    const uploads = await this.prisma.upload.findMany({
      where: {
        lessonId,
        triageStatus: 'confirmed',
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (uploads.length === 0) {
      return '暂无已归档的学生作品数据';
    }

    // 2. Aggregate data
    const aggregated = this.aggregateData(uploads);

    // 3. Build prompt for LLM
    const prompt = this.buildReportPrompt(aggregated);

    // 4. Call LLM to generate report
    try {
      const response = await callModelScopeChat(
        [
          {
            role: 'system',
            content: '你是一位经验丰富的教育分析专家，擅长从学生作品中洞察学习情况并提供教学建议。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          temperature: 0.7,
          maxTokens: 2000,
        }
      );

      return (response.choices[0]?.message?.content as string) || '生成报告失败';
    } catch (error) {
      console.error('Failed to generate report:', error);
      return `生成报告时出错: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  /**
   * Aggregate upload data for analysis
   */
  private aggregateData(uploads: any[]): AggregatedStats {
    const byType: Record<string, number> = {};
    const byEmotion: Record<string, number> = {};
    const keywordCount: Record<string, number> = {};
    const studentMap: Record<
      number,
      { studentId: number; studentName: string; count: number; types: Set<string> }
    > = {};

    for (const upload of uploads) {
      // Type distribution
      const type = upload.workType || '其他';
      byType[type] = (byType[type] || 0) + 1;

      // Emotion distribution
      try {
        const emotions = JSON.parse(upload.workEmotions || '[]');
        for (const emotion of emotions) {
          byEmotion[emotion] = (byEmotion[emotion] || 0) + 1;
        }
      } catch (e) {
        // Ignore parsing errors
      }

      // Keywords
      try {
        const keywords = JSON.parse(upload.workKeywords || '[]');
        for (const keyword of keywords) {
          keywordCount[keyword] = (keywordCount[keyword] || 0) + 1;
        }
      } catch (e) {
        // Ignore parsing errors
      }

      // Student participation
      if (upload.student) {
        if (!studentMap[upload.student.id]) {
          studentMap[upload.student.id] = {
            studentId: upload.student.id,
            studentName: upload.student.name,
            count: 0,
            types: new Set(),
          };
        }
        studentMap[upload.student.id].count++;
        studentMap[upload.student.id].types.add(type);
      }
    }

    // Sort keywords by frequency
    const topKeywords = Object.entries(keywordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword]) => keyword);

    // Convert student map to array
    const studentStats = Object.values(studentMap).map(s => ({
      ...s,
      types: Array.from(s.types),
    }));

    return {
      totalWorks: uploads.length,
      byType,
      byEmotion,
      topKeywords,
      studentStats,
    };
  }

  /**
   * Build prompt for report generation
   */
  private buildReportPrompt(stats: AggregatedStats): string {
    return `请基于以下学生作品数据，生成一份教育分析报告（800-1000字）。

**作品统计:**
- 总作品数: ${stats.totalWorks}
- 类型分布: ${JSON.stringify(stats.byType)}
- 情感分布: ${JSON.stringify(stats.byEmotion)}
- 高频关键词: ${stats.topKeywords.join('、')}

**学生参与情况:**
${stats.studentStats
  .sort((a, b) => b.count - a.count)
  .slice(0, 10)
  .map(s => `- ${s.studentName}: ${s.count}个作品 (${s.types.join('、')})`)
  .join('\n')}

**报告要求:**
请生成一份结构化的分析报告，包含以下部分：

## 1. 整体评价
简要总结本次作品的整体质量和特点（2-3句话）

## 2. 作品类型分析
- 分析不同类型作品的数量和占比
- 解读这种分布反映的教学效果
- 哪种类型最受欢迎？为什么？

## 3. 情感倾向分析
- 分析学生作品中体现的主要情感
- 这些情感与课程主题的关联
- 情感表达的多样性和深度

## 4. 主题内容分析
- 基于高频关键词，分析学生关注的核心主题
- 学生的创作视角和思维特点
- 内容的丰富性和创新性

## 5. 参与度分析
- 学生参与的积极性
- 是否有学生未提交作品
- 多作品学生的特点

## 6. 教学建议
- 针对当前情况的3-5条具体建议
- 如何在下次课程中改进
- 如何激发学生更多样化的创作

请用专业、客观但不失温度的语言撰写，注重实用性和可操作性。`;
  }

  /**
   * Save generated report to database
   */
  async saveReport(lessonId: number, content: string, type: string = 'class'): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    // Check if report already exists
    const existing = await this.prisma.report.findFirst({
      where: {
        lessonId,
        reportType: type,
      },
    });

    if (existing) {
      // Update existing report
      await this.prisma.report.update({
        where: { id: existing.id },
        data: {
          content,
          generatedAt: now,
        },
      });
    } else {
      // Create new report
      await this.prisma.report.create({
        data: {
          lessonId,
          reportType: type,
          content,
          generatedAt: now,
        },
      });
    }
  }

  /**
   * Get existing report for a lesson
   */
  async getReport(lessonId: number, type: string = 'class'): Promise<string | null> {
    const report = await this.prisma.report.findFirst({
      where: {
        lessonId,
        reportType: type,
      },
    });

    return report?.content || null;
  }
}
