/**
 * Report Generator Service
 * Generates AI-powered analysis reports for student works
 */

export const runtime = 'nodejs';

import type { Prisma, PrismaClient } from '@prisma/client';
import { callModelScopeChat } from '@/lib/modelscope/client';

type UploadWithStudent = Prisma.UploadGetPayload<{
  include: {
    student: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

/**
 * Aggregated statistics
 */
interface AggregatedStats {
  totalWorks: number;
  byType: Record<string, number>;
  byEmotion: Record<string, number>;
  topKeywords: string[];
  avgConsensus: number;
  multiModelCount: number;
  educationalInsights: {
    commonObservations: string[];
    topSuggestions: string[];
    ageDistribution: Record<string, number>;
    creativeHighlights: string[];
  };
  studentStats: Array<{
    studentId: number;
    studentName: string;
    count: number;
    types: string[];
    avgConsensus?: number;
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
  private aggregateData(uploads: UploadWithStudent[]): AggregatedStats {
    const byType: Record<string, number> = {};
    const byEmotion: Record<string, number> = {};
    const keywordCount: Record<string, number> = {};
    const studentMap: Record<
      number,
      {
        studentId: number;
        studentName: string;
        count: number;
        types: Set<string>;
        consensusSum: number;
        consensusCount: number;
      }
    > = {};
    const educationalObservations: string[] = [];
    const teachingSuggestions: string[] = [];
    const ageDistribution: Record<string, number> = {};
    const creativeHighlights: string[] = [];
    const multiModelUploads: number[] = [];

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
      } catch {
        // Ignore parsing errors
      }

      // Keywords
      try {
        const keywords = JSON.parse(upload.workKeywords || '[]');
        for (const keyword of keywords) {
          keywordCount[keyword] = (keywordCount[keyword] || 0) + 1;
        }
      } catch {
        // Ignore parsing errors
      }

      if (upload.educationalObservations) {
        educationalObservations.push(upload.educationalObservations);
      }
      if (upload.teachingSuggestions) {
        teachingSuggestions.push(upload.teachingSuggestions);
      }
      if (upload.ageAppropriateness) {
        ageDistribution[upload.ageAppropriateness] =
          (ageDistribution[upload.ageAppropriateness] || 0) + 1;
      }
      if (upload.creativeElements) {
        creativeHighlights.push(upload.creativeElements);
      }

      if (upload.modelCount && upload.modelCount > 1) {
        multiModelUploads.push(upload.modelConsensus ?? 0);
      }

      // Student participation
      if (upload.student) {
        if (!studentMap[upload.student.id]) {
          studentMap[upload.student.id] = {
            studentId: upload.student.id,
            studentName: upload.student.name,
            count: 0,
            types: new Set(),
            consensusSum: 0,
            consensusCount: 0,
          };
        }
        studentMap[upload.student.id].count++;
        studentMap[upload.student.id].types.add(type);
        if (typeof upload.modelConsensus === 'number') {
          studentMap[upload.student.id].consensusSum += upload.modelConsensus;
          studentMap[upload.student.id].consensusCount++;
        }
      }
    }

    // Sort keywords by frequency
    const topKeywords = Object.entries(keywordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword]) => keyword);

    // Convert student map to array
    const studentStats = Object.values(studentMap).map(s => ({
      studentId: s.studentId,
      studentName: s.studentName,
      count: s.count,
      types: Array.from(s.types),
      avgConsensus: s.consensusCount ? s.consensusSum / s.consensusCount : undefined,
    }));

    const avgConsensus = multiModelUploads.length
      ? multiModelUploads.reduce((sum, value) => sum + value, 0) / multiModelUploads.length
      : 0;

    return {
      totalWorks: uploads.length,
      byType,
      byEmotion,
      topKeywords,
      avgConsensus,
      multiModelCount: multiModelUploads.length,
      educationalInsights: {
        commonObservations: this.extractTopN(educationalObservations, 5),
        topSuggestions: this.extractTopN(teachingSuggestions, 5),
        ageDistribution,
        creativeHighlights: this.extractTopN(creativeHighlights, 3),
      },
      studentStats,
    };
  }

  /**
   * Build prompt for report generation
   */
  private buildReportPrompt(stats: AggregatedStats): string {
    const ageInsights = Object.entries(stats.educationalInsights.ageDistribution)
      .map(
        ([level, count]) =>
          `- ${level}：${count}件（${((count / stats.totalWorks) * 100 || 0).toFixed(1)}%）`
      )
      .join('\n');

    const studentLines = stats.studentStats
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(
        s =>
          `- ${s.studentName}：${s.count}件（类型：${s.types.join('、')}${
            s.avgConsensus ? `，平均一致性${(s.avgConsensus * 100).toFixed(0)}%` : ''
          }）`
      )
      .join('\n');

    return `作为教育分析专家，请基于以下班级数据生成一份专业报告：

## 基础统计
- 作品总数：${stats.totalWorks}件
- 作品类型分布：${JSON.stringify(stats.byType)}
- 情感标签：${JSON.stringify(stats.byEmotion)}
- 关键词TOP10：${stats.topKeywords.join('、')}

## 多模型分析质量
- 使用多模型的作品：${stats.multiModelCount}件（${(
      (stats.multiModelCount / Math.max(stats.totalWorks, 1)) *
      100
    ).toFixed(1)}%）
- 平均模型一致性：${(stats.avgConsensus * 100).toFixed(1)}%
${stats.avgConsensus > 0.7 ? '（AI模型对作品的理解高度一致，可信度高）' : ''}

## 教育专业洞察（Qwen3-VL-235B）
- 学生发展观察：
${stats.educationalInsights.commonObservations.map((obs, idx) => `${idx + 1}. ${obs}`).join('\n') || '- 暂无'}
- 年龄适宜性：
${ageInsights || '- 暂无数据'}
- 创造性亮点：
${stats.educationalInsights.creativeHighlights.map((item, idx) => `${idx + 1}. ${item}`).join('\n') || '- 暂无'}
- 教学建议：
${stats.educationalInsights.topSuggestions.map((item, idx) => `${idx + 1}. ${item}`).join('\n') || '- 暂无'}

## 学生参与情况（Top 10）
${studentLines || '- 暂无归档数据'}

---

请基于以上数据生成 800-1000 字的报告，结构包含：
1. 整体表现概述：参与度、作品质量、多模型表现。
2. 内容与情感分析：主题、情感、创造力亮点。
3. 教育专业评估：学生发展水平、年龄适宜性、能力表现。
4. 个性化发现：表现突出学生及支持建议。
5. 教学建议：基于AI教育观察的可操作建议，突出AI赋能价值。

报告语言要求：专业、积极、易懂，适合乡村教师阅读，重点强调AI多模型带来的洞察价值。`;
  }

  private extractTopN(texts: string[], limit: number): string[] {
    return Array.from(new Set(texts.filter(Boolean))).slice(0, limit);
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
