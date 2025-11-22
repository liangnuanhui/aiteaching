import type { FusedResult, ModelAnalysisResult } from '@/lib/ocr/multi-model-client';

export interface ResultFusionOptions {
  modelWeights: Record<string, number>;
}

const DEFAULT_WEIGHT = 1;

function getWeight(modelName: string, options: ResultFusionOptions): number {
  return options.modelWeights[modelName] ?? DEFAULT_WEIGHT;
}

export function fuseResults(
  results: ModelAnalysisResult[],
  options: ResultFusionOptions
): FusedResult {
  if (results.length === 0) {
    throw new Error('No model results available for fusion');
  }

  const studentName = fuseStudentName(results, options);
  const workType = fuseWorkType(results, options);
  const description = fuseDescription(results, options);
  const textContent = fuseTextContent(results, options);
  const keywords = fuseKeywords(results, options);
  const emotions = fuseEmotions(results, options);
  const confidence = fuseConfidence(results, options);
  const modelConsensus = calculateConsensus(results);
  const educationalInsights = fuseEducationalInsights(results);

  const fusionMethod: FusedResult['fusionMethod'] =
    results.length === 1
      ? 'single_model'
      : modelConsensus >= 0.75
        ? 'consensus'
        : 'weighted_voting';

  return {
    studentName,
    workType,
    description,
    textContent,
    keywords,
    emotions,
    confidence,
    modelConsensus,
    educationalInsights,
    detailedResults: results,
    fusionMethod,
  };
}

export function fuseStudentName(
  results: ModelAnalysisResult[],
  options: ResultFusionOptions
): string {
  const nameCandidates: Map<string, number> = new Map();

  for (const result of results) {
    if (!result.studentName) {
      continue;
    }

    const weight = getWeight(result.modelName, options);
    const score = weight * (result.confidence || 0.5);
    nameCandidates.set(result.studentName, (nameCandidates.get(result.studentName) || 0) + score);
  }

  return (
    Array.from(nameCandidates.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0]
      ?.trim() ?? ''
  );
}

export function fuseWorkType(results: ModelAnalysisResult[], options: ResultFusionOptions): string {
  const typeVotes: Map<string, number> = new Map();

  for (const result of results) {
    const weight = getWeight(result.modelName, options);
    const workType = result.workType || '其他';
    typeVotes.set(workType, (typeVotes.get(workType) || 0) + weight);
  }

  return (
    Array.from(typeVotes.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0]
      ?.trim() ?? '其他'
  );
}

export function fuseDescription(
  results: ModelAnalysisResult[],
  options: ResultFusionOptions
): string {
  const entries: Array<{ description: string; score: number }> = [];

  for (const result of results) {
    if (!result.description) {
      continue;
    }

    const weight = getWeight(result.modelName, options);
    const normalizedLength = Math.min(result.description.length, 200) / 100;
    const score = Math.max(result.confidence, 0.4) * weight * (1 + normalizedLength);
    entries.push({ description: result.description, score });
  }

  return entries.sort((a, b) => b.score - a.score)[0]?.description ?? '';
}

export function fuseTextContent(
  results: ModelAnalysisResult[],
  options: ResultFusionOptions
): string {
  const entries: Array<{ content: string; score: number }> = [];

  for (const result of results) {
    if (!result.textContent) {
      continue;
    }

    const weight = getWeight(result.modelName, options);
    const normalizedLength = Math.min(result.textContent.length, 400) / 200;
    const score = (result.confidence || 0.5) * weight * (1 + normalizedLength);
    entries.push({ content: result.textContent, score });
  }

  return entries.sort((a, b) => b.score - a.score)[0]?.content ?? '';
}

export function fuseKeywords(
  results: ModelAnalysisResult[],
  options: ResultFusionOptions
): string[] {
  const keywordScores: Map<string, number> = new Map();

  for (const result of results) {
    const weight = getWeight(result.modelName, options);
    for (const keyword of result.keywords || []) {
      if (!keyword) {
        continue;
      }
      keywordScores.set(keyword, (keywordScores.get(keyword) || 0) + weight);
    }
  }

  return Array.from(keywordScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword]) => keyword);
}

export function fuseEmotions(
  results: ModelAnalysisResult[],
  options: ResultFusionOptions
): string[] {
  const emotionScores: Map<string, number> = new Map();

  for (const result of results) {
    const weight = getWeight(result.modelName, options);
    for (const emotion of result.emotions || []) {
      if (!emotion) {
        continue;
      }
      emotionScores.set(emotion, (emotionScores.get(emotion) || 0) + weight);
    }
  }

  return Array.from(emotionScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emotion]) => emotion);
}

export function fuseConfidence(
  results: ModelAnalysisResult[],
  options: ResultFusionOptions
): number {
  const totalWeight = results.reduce(
    (sum, result) => sum + getWeight(result.modelName, options),
    0
  );
  if (totalWeight === 0) {
    return results.reduce((sum, r) => sum + (r.confidence || 0), 0) / (results.length || 1);
  }

  const weightedConfidence = results.reduce(
    (sum, result) => sum + (result.confidence || 0) * getWeight(result.modelName, options),
    0
  );

  return Math.min(1, Math.max(0, weightedConfidence / totalWeight));
}

export function calculateConsensus(results: ModelAnalysisResult[]): number {
  if (results.length < 2) {
    return 1;
  }

  const workTypes = results.map(r => r.workType || '');
  const uniqueTypes = new Set(workTypes.filter(Boolean)).size || 1;
  const typeScore = 1 - Math.min(1, uniqueTypes / workTypes.length);

  const emotionSets = results.map(r => new Set(r.emotions || []));
  const emotionScore = calculateJaccardSimilarity(emotionSets);

  const keywordSets = results.map(r => new Set(r.keywords || []));
  const keywordScore = calculateJaccardSimilarity(keywordSets);

  const confidences = results.map(r => r.confidence || 0);
  const mean = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  const variance =
    confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) /
    Math.max(confidences.length, 1);
  const stdDev = Math.sqrt(variance);
  const confidenceScore = Math.max(0, 1 - stdDev);

  const consensus =
    typeScore * 0.3 + emotionScore * 0.25 + keywordScore * 0.25 + confidenceScore * 0.2;
  return Math.min(1, Math.max(0, consensus));
}

export function calculateJaccardSimilarity(sets: Set<string>[]): number {
  if (sets.length < 2) {
    return 0;
  }

  let totalSimilarity = 0;
  let pairCount = 0;

  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const setA = sets[i];
      const setB = sets[j];
      if (!setA || !setB) {
        continue;
      }

      const intersection = new Set([...setA].filter(item => setB.has(item)));
      const union = new Set([...setA, ...setB]);

      if (union.size === 0) {
        continue;
      }

      totalSimilarity += intersection.size / union.size;
      pairCount++;
    }
  }

  if (pairCount === 0) {
    return 0;
  }

  return totalSimilarity / pairCount;
}

export function fuseEducationalInsights(
  results: ModelAnalysisResult[]
): FusedResult['educationalInsights'] {
  const primaryResult = results.find(result => result.modelName.includes('235'));
  const fallbackResult = results.find(result => Boolean(result.educationalObservations));
  const source = primaryResult ?? fallbackResult;

  if (!source || !source.educationalObservations) {
    return undefined;
  }

  return {
    observations: source.educationalObservations,
    suggestions: source.teachingSuggestions ?? '',
    ageAppropriateness: source.ageAppropriateness ?? '符合',
    creativeElements: source.creativeElements ?? '',
  };
}
