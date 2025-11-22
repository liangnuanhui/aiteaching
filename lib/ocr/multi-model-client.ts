export const runtime = 'nodejs';

import { getEnv } from '@/lib/config/env';
import {
  callModelScopeChat,
  getMessageContentText,
  type ChatMessage,
} from '@/lib/modelscope/client';
import { fuseResults, type ResultFusionOptions } from '@/lib/ocr/result-fusion';
import { getMimeType, imageToBase64, validateImageSize } from '@/lib/ocr/image-utils';

export type WorkContentType = 'drawing' | 'handcraft' | 'writing' | 'mixed';

export interface ModelConfig {
  name: string;
  label: string;
  type: 'qwen30b' | 'qwen235b' | 'gpt4v' | 'claude' | 'doubao';
  modelId?: string;
  apiEndpoint?: string;
  apiKey?: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  weight: number;
  enabled: boolean;
}

export interface ModelAnalysisResult {
  modelName: string;
  studentName: string;
  workType: string;
  description: string;
  textContent: string;
  keywords: string[];
  emotions: string[];
  confidence: number;
  educationalObservations?: string;
  teachingSuggestions?: string;
  ageAppropriateness?: string;
  creativeElements?: string;
  analysisTime: number;
  rawResponse: string;
}

export interface FusedResult {
  studentName: string;
  workType: string;
  description: string;
  textContent: string;
  keywords: string[];
  emotions: string[];
  confidence: number;
  modelConsensus: number;
  educationalInsights?: {
    observations: string;
    suggestions: string;
    ageAppropriateness: string;
    creativeElements: string;
  };
  detailedResults: ModelAnalysisResult[];
  fusionMethod: 'single_model' | 'weighted_voting' | 'consensus';
}

const DEFAULT_STANDARD_PROMPT = `请仔细分析这张学生作品照片,以JSON格式返回:
{
  "student_name": "手写姓名,无则返回空字符串",
  "work_type": "【绘画、手工制作、文字书写、综合创作】四选一",
  "description": "20-30字描述主题和特征",
  "text_content": "按顺序识别所有文字内容",
  "keywords": ["主题词", "视觉元素", "关键概念"],
  "emotions": ["快乐、温馨、思念、感恩、自豪、期待、创意、努力等"]
}

**重要规则:**
- 只返回JSON对象,不要任何解释性文字
- student_name字段:如果照片中有手写姓名则识别,没有则返回空字符串""
- text_content字段:提取所有可见的文字内容(包括但不限于姓名)
- 所有字段都必须填写,不能省略`;

const QWEN235B_EDUCATION_PROMPT = `你是一位经验丰富的教育专家，专门分析小学生的作品。请仔细分析这张学生作品照片，以JSON格式返回以下结构化信息：

{
  "student_name": "图片上清晰可辨的学生手写姓名，如果没有则返回空字符串",
  "work_type": "从【绘画创作、手工制作、文字书写、综合创作】中选择最符合的一项",
  "description": "用40-60字从教育角度专业描述作品的主题、内容、创意特点和视觉表现",
  "text_content": "按阅读顺序识别图片中出现的所有文字内容，包括标题、正文、签名等",
  "keywords": ["作品核心主题词", "主要视觉元素", "表达的教育概念", "体现的能力要素"],
  "emotions": ["从【快乐、温馨、思念、感恩、自豪、期待、创意、努力、专注、惊喜、温暖、幸福】中选择最贴切的1-3个"],
  "educational_observations": "从教育观察角度分析作品体现的学生发展水平、学习成果、能力特点（50-80字）",
  "teaching_suggestions": "基于作品分析，给教师的教学建议（30-50字）",
  "age_appropriateness": "评估作品表现是否符合小学生年龄特点（符合/超越/需要支持）",
  "creative_elements": "分析作品中体现的创造性思维和独特表达"
}

【教育专业分析指导】：
- 采用积极正面的教育评价语言
- 注重发现学生的潜能和优势
- 从发展性角度进行专业评估
- 提供具体可操作的教学建议
- 体现以学生为中心的教育理念
- 关注个体差异和个性化发展

【返回要求】：
- 只返回标准JSON格式，不要添加任何解释文字
- 确保所有字段都有合适的内容
- 教育观察要具体、专业、有针对性
- 教学建议要实用、可操作、符合教育规律`; // eslint-disable-line max-len

interface NormalizedFields {
  studentName: string;
  workType: string;
  description: string;
  textContent: string;
  keywords: string[];
  emotions: string[];
  educationalObservations?: string;
  teachingSuggestions?: string;
  ageAppropriateness?: string;
  creativeElements?: string;
}

const SINGLE_MODEL_TIMEOUT_MS = getEnv('SINGLE_MODEL_TIMEOUT') * 1000;
const MULTI_MODEL_TIMEOUT_MS = getEnv('MULTI_MODEL_TIMEOUT') * 1000;

const MODELSCOPE_KEY = getEnv('MODELSCOPE_API_KEY');
const OPENAI_KEY = getEnv('OPENAI_API_KEY');
const ANTHROPIC_KEY = getEnv('ANTHROPIC_API_KEY');
const DOUBAO_KEY = getEnv('DOUBAO_API_KEY');

const MODEL_CONFIGS: ModelConfig[] = [
  {
    name: 'qwen30b',
    label: 'Qwen3-VL-30B',
    type: 'qwen30b',
    modelId: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
    maxTokens: 1200,
    temperature: 0.1,
    timeout: SINGLE_MODEL_TIMEOUT_MS,
    weight: getEnv('QWEN30B_WEIGHT'),
    enabled: Boolean(MODELSCOPE_KEY),
  },
  {
    name: 'qwen235b',
    label: 'Qwen3-VL-235B',
    type: 'qwen235b',
    modelId: 'Qwen/Qwen3-VL-235B-Instruct',
    maxTokens: 1600,
    temperature: 0.1,
    timeout: SINGLE_MODEL_TIMEOUT_MS,
    weight: getEnv('QWEN235B_WEIGHT'),
    enabled: Boolean(MODELSCOPE_KEY),
  },
  {
    name: 'gpt4v',
    label: 'GPT-4 Vision',
    type: 'gpt4v',
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: OPENAI_KEY ?? undefined,
    modelId: 'gpt-4o-mini',
    maxTokens: 1500,
    temperature: 0.2,
    timeout: SINGLE_MODEL_TIMEOUT_MS,
    weight: getEnv('GPT4V_WEIGHT'),
    enabled: Boolean(OPENAI_KEY && getEnv('ENABLE_GPT4_VISION')),
  },
  {
    name: 'claude',
    label: 'Claude 3.5 Vision',
    type: 'claude',
    apiEndpoint: 'https://api.anthropic.com/v1/messages',
    apiKey: ANTHROPIC_KEY ?? undefined,
    modelId: 'claude-3-5-sonnet-20241022',
    maxTokens: 1200,
    temperature: 0.2,
    timeout: SINGLE_MODEL_TIMEOUT_MS,
    weight: getEnv('CLAUDE_WEIGHT'),
    enabled: Boolean(ANTHROPIC_KEY && getEnv('ENABLE_CLAUDE_VISION')),
  },
  {
    name: 'doubao',
    label: '豆包视觉',
    type: 'doubao',
    apiEndpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    apiKey: DOUBAO_KEY ?? undefined,
    modelId: 'ep-doubao-vision-pro',
    maxTokens: 1200,
    temperature: 0.3,
    timeout: SINGLE_MODEL_TIMEOUT_MS,
    weight: getEnv('DOUBAO_WEIGHT'),
    enabled: Boolean(DOUBAO_KEY && getEnv('ENABLE_DOUBAO_VL')),
  },
];

export class MultiModelClient {
  private readonly configs: ModelConfig[];

  private readonly fusionOptions: ResultFusionOptions;

  constructor(configs: ModelConfig[] = MODEL_CONFIGS) {
    this.configs = configs;
    this.fusionOptions = {
      modelWeights: configs.reduce<Record<string, number>>((acc, config) => {
        acc[config.name] = config.weight;
        return acc;
      }, {}),
    };
  }

  async analyzeImageMultiModel(
    imagePath: string,
    contentType?: WorkContentType
  ): Promise<FusedResult> {
    validateImageSize(imagePath);
    const enabledModels = this.getEnabledModels();

    if (enabledModels.length === 0) {
      throw new Error('No vision models are configured. Please set MODELSCOPE_API_KEY first.');
    }

    const base64 = await imageToBase64(imagePath);
    const mimeType = getMimeType(imagePath);
    const imageDataUrl = `data:${mimeType};base64,${base64}`;

    const tasks = enabledModels.map(model =>
      this.runWithTimeout(
        this.analyzeWithModel(model, {
          imageDataUrl,
          imageBase64: base64,
          mimeType,
          contentType,
        }),
        model.timeout,
        `${model.label} request timed out`
      )
    );

    const settled = await this.runWithTimeout(
      Promise.allSettled(tasks),
      MULTI_MODEL_TIMEOUT_MS,
      'Multi-model analysis timed out'
    );

    const successfulResults = settled
      .filter(
        (result): result is PromiseFulfilledResult<ModelAnalysisResult> =>
          result.status === 'fulfilled'
      )
      .map(result => result.value);

    if (successfulResults.length === 0) {
      throw new Error('All configured models failed to analyze the image');
    }

    return fuseResults(successfulResults, this.fusionOptions);
  }

  private getEnabledModels(): ModelConfig[] {
    return this.configs.filter(config => config.enabled);
  }

  private async analyzeWithModel(
    model: ModelConfig,
    params: {
      imageDataUrl: string;
      imageBase64: string;
      mimeType: string;
      contentType?: WorkContentType;
    }
  ): Promise<ModelAnalysisResult> {
    const start = Date.now();
    let rawResponse = '';
    try {
      const prompt = this.buildPrompt(model, params.contentType);

      switch (model.type) {
        case 'qwen30b':
        case 'qwen235b': {
          const response = await this.callQwenVision(model, prompt, params.imageDataUrl);
          rawResponse = response;
          const normalized = this.normalizeFields(
            this.parseModelResponse(response),
            model.type === 'qwen235b'
          );
          return this.buildModelResult(model, normalized, rawResponse, Date.now() - start);
        }
        case 'gpt4v': {
          rawResponse = await this.callOpenAIVision(model, prompt, params.imageDataUrl);
          const normalized = this.normalizeFields(this.parseModelResponse(rawResponse));
          return this.buildModelResult(model, normalized, rawResponse, Date.now() - start);
        }
        case 'claude': {
          rawResponse = await this.callClaudeVision(
            model,
            prompt,
            params.imageBase64,
            params.mimeType
          );
          const normalized = this.normalizeFields(this.parseModelResponse(rawResponse));
          return this.buildModelResult(model, normalized, rawResponse, Date.now() - start);
        }
        case 'doubao': {
          rawResponse = await this.callDoubaoVision(model, prompt, params.imageDataUrl);
          const normalized = this.normalizeFields(this.parseModelResponse(rawResponse));
          return this.buildModelResult(model, normalized, rawResponse, Date.now() - start);
        }
        default:
          throw new Error(`Unsupported model type: ${model.type}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[${model.label}] ${message}`);
    }
  }

  private buildPrompt(model: ModelConfig, contentType?: WorkContentType): string {
    if (model.type === 'qwen235b') {
      return QWEN235B_EDUCATION_PROMPT;
    }

    if (!contentType) {
      return DEFAULT_STANDARD_PROMPT;
    }

    return `${DEFAULT_STANDARD_PROMPT}\n\n作品可能属于: ${this.describeContentType(contentType)}，请结合类型特点进行分析。`;
  }

  private describeContentType(contentType: WorkContentType): string {
    switch (contentType) {
      case 'drawing':
        return '绘画创作';
      case 'handcraft':
        return '手工制作';
      case 'writing':
        return '文字书写';
      case 'mixed':
        return '综合创作';
      default:
        return '综合创作';
    }
  }

  private async callQwenVision(
    model: ModelConfig,
    prompt: string,
    imageDataUrl: string
  ): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ];

    const response = await callModelScopeChat(messages, {
      model: model.modelId,
      temperature: model.temperature,
      maxTokens: model.maxTokens,
    });

    return getMessageContentText(response.choices[0]?.message?.content);
  }

  private async callOpenAIVision(
    model: ModelConfig,
    prompt: string,
    imageDataUrl: string
  ): Promise<string> {
    if (!model.apiKey || !model.apiEndpoint) {
      throw new Error('OpenAI credentials are not configured');
    }

    const response = await fetch(model.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: model.modelId,
        temperature: model.temperature,
        max_tokens: model.maxTokens,
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant helping teachers analyze student works.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error (${response.status})`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    };
    const message = data.choices?.[0]?.message?.content;
    if (!message) {
      throw new Error('OpenAI response is empty');
    }

    if (typeof message === 'string') {
      return message;
    }

    return message
      .map((part: { type?: string; text?: string }) =>
        part.type === 'text' ? (part.text ?? '') : ''
      )
      .join('\n');
  }

  private async callClaudeVision(
    model: ModelConfig,
    prompt: string,
    imageBase64: string,
    mimeType: string
  ): Promise<string> {
    if (!model.apiKey || !model.apiEndpoint) {
      throw new Error('Claude credentials are not configured');
    }

    const response = await fetch(model.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': model.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model.modelId,
        max_tokens: model.maxTokens,
        temperature: model.temperature,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mimeType, data: imageBase64 },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error (${response.status})`);
    }

    const data = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
    const content = data.content?.[0];
    if (!content) {
      throw new Error('Claude response is empty');
    }

    if (content.type === 'text') {
      return content.text ?? '';
    }

    return JSON.stringify(data);
  }

  private async callDoubaoVision(
    model: ModelConfig,
    prompt: string,
    imageDataUrl: string
  ): Promise<string> {
    if (!model.apiKey || !model.apiEndpoint) {
      throw new Error('Doubao credentials are not configured');
    }

    const response = await fetch(model.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: model.modelId,
        temperature: model.temperature,
        max_tokens: model.maxTokens,
        messages: [
          { role: 'system', content: '你是一位教育AI助手，负责分析学生作品。' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Doubao API error (${response.status})`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    };
    const message = data.choices?.[0]?.message?.content;
    if (!message) {
      throw new Error('Doubao response is empty');
    }

    if (typeof message === 'string') {
      return message;
    }

    return message
      .map((part: { type?: string; text?: string }) =>
        part.type === 'text' ? (part.text ?? '') : ''
      )
      .join('\n');
  }

  private parseModelResponse(raw: string): Record<string, unknown> {
    let text = raw.trim();
    const codeBlockMatch =
      text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
    if (codeBlockMatch) {
      text = codeBlockMatch[1].trim();
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Model response is not a valid JSON object');
    }

    return parsed as Record<string, unknown>;
  }

  private normalizeFields(
    data: Record<string, unknown>,
    includeEducation = false
  ): NormalizedFields {
    const studentName = (data.student_name ?? data.studentName ?? '') as string;
    const workType = (data.work_type ?? data.workType ?? '其他') as string;
    const description = (data.description ?? '') as string;
    const textContent = (data.text_content ?? data.textContent ?? '') as string;
    const keywords = this.ensureStringArray(data.keywords);
    const emotions = this.ensureStringArray(data.emotions);

    const normalized: NormalizedFields = {
      studentName: studentName.trim(),
      workType: this.normalizeWorkType(workType),
      description: description.trim(),
      textContent: textContent.trim(),
      keywords,
      emotions,
    };

    if (includeEducation) {
      normalized.educationalObservations = (data.educational_observations ??
        data.educationalObservations ??
        '') as string;
      normalized.teachingSuggestions = (data.teaching_suggestions ??
        data.teachingSuggestions ??
        '') as string;
      normalized.ageAppropriateness = (data.age_appropriateness ??
        data.ageAppropriateness ??
        '符合') as string;
      normalized.creativeElements = (data.creative_elements ??
        data.creativeElements ??
        '') as string;
    }

    return normalized;
  }

  private normalizeWorkType(type: string): string {
    const normalized = type.replace('作品', '').replace('创作', '').trim();
    const mapping: Record<string, string> = {
      绘画: '绘画创作',
      绘画创作: '绘画创作',
      手工制作: '手工制作',
      文字书写: '文字书写',
      综合创作: '综合创作',
    };
    return mapping[normalized] ?? mapping[type] ?? '综合创作';
  }

  private ensureStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  }

  private buildModelResult(
    model: ModelConfig,
    payload: NormalizedFields,
    rawResponse: string,
    analysisTime: number
  ): ModelAnalysisResult {
    return {
      modelName: model.name,
      studentName: payload.studentName,
      workType: payload.workType,
      description: payload.description,
      textContent: payload.textContent,
      keywords: payload.keywords,
      emotions: payload.emotions,
      confidence: this.estimateConfidence(payload),
      educationalObservations: payload.educationalObservations,
      teachingSuggestions: payload.teachingSuggestions,
      ageAppropriateness: payload.ageAppropriateness,
      creativeElements: payload.creativeElements,
      analysisTime,
      rawResponse,
    };
  }

  private estimateConfidence(payload: NormalizedFields): number {
    let score = 0.45;
    if (payload.studentName) {
      score += 0.15;
    }
    if (payload.description.length > 20) {
      score += 0.1;
    }
    if (payload.textContent.length > 10) {
      score += 0.1;
    }
    score += Math.min(payload.keywords.length, 5) * 0.04;
    score += Math.min(payload.emotions.length, 3) * 0.05;

    return Math.min(0.98, Math.max(0.3, score));
  }

  private async runWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}

let cachedClient: MultiModelClient | null = null;

export function getMultiModelClient(): MultiModelClient {
  if (!cachedClient) {
    cachedClient = new MultiModelClient();
  }
  return cachedClient;
}
