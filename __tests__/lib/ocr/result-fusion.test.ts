import { describe, expect, it } from 'vitest';

import { calculateConsensus, fuseResults } from '@/lib/ocr/result-fusion';
import type { ModelAnalysisResult } from '@/lib/ocr/multi-model-client';

const modelWeights = {
  qwen30b: 1.2,
  qwen235b: 1.5,
  gpt4v: 1.0,
};

function buildResult(partial: Partial<ModelAnalysisResult>): ModelAnalysisResult {
  return {
    modelName: 'qwen30b',
    studentName: '',
    workType: '绘画创作',
    description: '作品描述',
    textContent: '作品文本内容',
    keywords: ['色彩'],
    emotions: ['快乐'],
    visualElements: [],
    confidence: 0.8,
    analysisTime: 1000,
    rawResponse: '{}',
    ...partial,
  };
}

describe('Result Fusion', () => {
  it('fuses student names based on weighted confidence', () => {
    const fused = fuseResults(
      [
        buildResult({ modelName: 'qwen30b', studentName: '张三', confidence: 0.92 }),
        buildResult({ modelName: 'qwen235b', studentName: '张三', confidence: 0.87 }),
        buildResult({ modelName: 'gpt4v', studentName: '张山', confidence: 0.7 }),
      ],
      { modelWeights }
    );

    expect(fused.studentName).toBe('张三');
    expect(fused.keywords.length).toBeGreaterThan(0);
  });

  it('calculates higher consensus for aligned models', () => {
    const results = [
      buildResult({
        modelName: 'qwen30b',
        workType: '绘画创作',
        emotions: ['快乐', '创意'],
        keywords: ['花朵', '色彩'],
      }),
      buildResult({
        modelName: 'qwen235b',
        workType: '绘画创作',
        emotions: ['快乐', '创意'],
        keywords: ['花朵', '色彩'],
      }),
    ];

    const consensus = calculateConsensus(results);
    expect(consensus).toBeGreaterThan(0.6);
  });

  it('handles single-model results gracefully', () => {
    const fused = fuseResults(
      [buildResult({ modelName: 'qwen30b', studentName: '李四', confidence: 0.85 })],
      { modelWeights }
    );

    expect(fused.fusionMethod).toBe('single_model');
    expect(fused.modelConsensus).toBe(1);
    expect(fused.studentName).toBe('李四');
  });
});
