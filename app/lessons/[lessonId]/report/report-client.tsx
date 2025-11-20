/**
 * Report Client Component
 * Client-side component for report generation and display
 */

'use client';

import React, { useState } from 'react';

interface ReportClientProps {
  lessonId: number;
  initialReport: string | null;
  canGenerate: boolean;
}

export function ReportClient({ lessonId, initialReport, canGenerate }: ReportClientProps) {
  const [report, setReport] = useState(initialReport);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/lessons/${lessonId}/report`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const data = (await response.json()) as { content: string };
      setReport(data.content);
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('生成报告失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!report && !canGenerate) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
        <div className="text-yellow-900 font-medium mb-2">暂无数据</div>
        <div className="text-yellow-700 text-sm">请先完成学生作品的归档，然后才能生成分析报告</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-white rounded-lg p-8 shadow-sm text-center">
        <div className="mb-4">
          <div className="text-lg font-medium mb-2">尚未生成分析报告</div>
          <div className="text-gray-600 text-sm mb-6">
            系统将基于已归档的学生作品，使用AI生成详细的分析报告
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isGenerating ? '生成中...' : '生成分析报告'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-8 shadow-sm">
      {/* Regenerate Button */}
      <div className="mb-6 flex justify-end">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isGenerating ? '重新生成中...' : '重新生成报告'}
        </button>
      </div>

      {/* Report Content - Simple Markdown Rendering */}
      <div className="prose prose-slate max-w-none">
        <div
          className="markdown-content"
          dangerouslySetInnerHTML={{
            __html: formatMarkdown(report),
          }}
        />
      </div>
    </div>
  );
}

/**
 * Simple markdown-to-HTML formatter
 * Supports: headings, lists, bold, paragraphs
 */
function formatMarkdown(markdown: string): string {
  let html = markdown;

  // Escape HTML special characters first
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  };

  html = html.replace(/[&<>]/g, char => escapeMap[char] ?? char);

  // Headers (## -> h2, ### -> h3)
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-8 mb-4">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>');

  // Bold text
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>');
  html = html.replace(/(<li.*<\/li>)/s, '<ul class="list-disc ml-6 mb-4">$1</ul>');

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4">$1</li>');

  // Paragraphs (lines separated by blank lines)
  html = html
    .split('\n\n')
    .map(para => {
      if (
        para.startsWith('<h') ||
        para.startsWith('<ul>') ||
        para.startsWith('<ol>') ||
        para.startsWith('<li>')
      ) {
        return para;
      }
      return `<p class="mb-4 text-gray-700 leading-relaxed">${para.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  return html;
}
