/**
 * Qwen VL OCR Client
 *
 * Uses ModelScope's Qwen3-VL-30B-A3B-Instruct model to perform:
 * - Handwritten name recognition
 * - Work type classification
 * - Content description
 * - Keyword extraction
 * - Emotion analysis
 */

import { callModelScopeChat, type ChatMessage } from '@/lib/modelscope/client';
import { imageToDataURL, validateImageSize } from './image-utils';

/**
 * OCR recognition result
 */
export interface OCRResult {
  /** Recognized student name (empty if not found) */
  studentName: string;

  /** Work type: 绘画/手工制作/文字书写/综合创作 */
  workType: string;

  /** 50-80 character detailed description of the work */
  description: string;

  /** All text content extracted from the image */
  textContent: string;

  /** Keywords describing the work */
  keywords: string[];

  /** Emotional tags */
  emotions: string[];

  /** Visual elements detected (especially for artwork) */
  visualElements: string[];

  /** Raw response from the model */
  rawResponse?: string;
}

/**
 * Default VL model for OCR
 */
const DEFAULT_VL_MODEL = 'Qwen/Qwen3-VL-30B-A3B-Instruct';

/**
 * Multi-task prompt template for student work analysis
 */
const MULTI_TASK_PROMPT = `请仔细分析这张学生作品照片,以JSON格式返回:
{
  "student_name": "手写姓名,无则返回空字符串",
  "work_type": "【绘画、手工制作、文字书写、综合创作】四选一",
  "description": "50-80字详细描述主题、内容和特征",
  "text_content": "按顺序识别所有文字内容",
  "keywords": ["主题词", "视觉元素", "关键概念"],
  "emotions": ["快乐、温馨、思念、感恩、自豪、期待、创意、努力等"],
  "visual_elements": ["画面中的具体物体名称"]
}

**分析指导:**
1. 绘画作品:
   - description: 详细描述画了什么(如: 兔子、人物、树木、房子、太阳等)，画面的构图、色彩和风格
   - visual_elements: 列出画面中所有识别到的物体(如: ["兔子", "月亮", "草地", "花朵"])
2. 手工作品: 描述材料、工艺、造型、创意表现
3. 文字作品: 描述字体、排版、内容主题
4. 综合创作: 同时包含多种创作形式
5. 情感标签: 基于画面氛围、色彩、文字内容综合判断,可多选
6. 关键词: 提取3-5个核心概念词
7. visual_elements: 重点识别绘画/手工作品中的具体物体，如动物、植物、人物、建筑、自然元素等

**重要规则:**
- 只返回JSON对象,不要任何解释性文字
- student_name字段:如果照片中有手写姓名则识别,没有则返回空字符串""
- text_content字段:提取所有可见的文字内容(包括但不限于姓名)
- description字段:绘画作品必须说明画了哪些具体物体(如"画中有一只白色的兔子、一轮圆月、绿色的草地")
- visual_elements字段:列出所有识别到的物体名称(绘画/手工作品必须填写，文字作品可为空数组)
- 所有字段都必须填写,不能省略`;

/**
 * Deep analysis prompt for artwork (绘画专项分析)
 */
const ARTWORK_DEEP_ANALYSIS_PROMPT = `这是一幅小学生的绘画作品。请进行深度视觉分析，以JSON格式返回:
{
  "visual_elements": ["画面中所有可识别的物体"],
  "detailed_description": "80-120字详细描述",
  "composition": "画面构图和布局特点",
  "colors": "色彩使用和搭配",
  "techniques": "绘画技法和表现手法",
  "emotions": "画面表达的情感"
}

**深度分析要点:**
1. visual_elements: 详细列出画面中的所有物体
   - 动物(如: 兔子、狗、猫、鸟等)
   - 人物(如: 小孩、大人、家人等)
   - 植物(如: 树、花、草等)
   - 建筑(如: 房子、学校等)
   - 自然元素(如: 太阳、月亮、云、星星等)
   - 其他物品

2. detailed_description: 详细描述画面内容
   - 每个物体的特征(大小、颜色、位置)
   - 物体之间的关系
   - 整体画面故事性

3. composition: 构图分析
   - 主体位置(居中/偏左/偏右等)
   - 前景/中景/背景关系
   - 空间感和层次感

4. colors: 色彩分析
   - 主要色调
   - 色彩搭配
   - 色彩对情感的表达

5. techniques: 技法分析
   - 线条运用(流畅/稚拙/工整等)
   - 填色方式
   - 细节处理

**重要:**
- 只返回JSON对象
- visual_elements必须包含所有识别到的物体名称
- 所有字段都必须填写`;

/**
 * Qwen VL Client for OCR
 */
export class QwenVLClient {
  private model: string;

  constructor(model: string = DEFAULT_VL_MODEL) {
    this.model = model;
  }

  /**
   * Recognize and analyze a student work image
   *
   * @param imagePath - Path to the image file
   * @returns OCR result with recognized information
   */
  async recognizeImage(imagePath: string): Promise<OCRResult> {
    // 1. Validate image size (max 10MB)
    validateImageSize(imagePath);

    // 2. Convert image to data URL
    const imageDataURL = await imageToDataURL(imagePath);

    // 3. Build messages with multi-modal content
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: MULTI_TASK_PROMPT,
          },
          {
            type: 'image_url',
            image_url: {
              url: imageDataURL,
            },
          },
        ],
      },
    ];

    // 4. Call ModelScope API
    try {
      const response = await callModelScopeChat(messages, {
        model: this.model,
        temperature: 0.1, // Low temperature for consistent output
        maxTokens: 1000,
      });

      // 5. Parse response
      const rawResponse = response.choices[0]?.message?.content;

      if (!rawResponse) {
        throw new Error('Empty response from ModelScope API');
      }

      const result = this.parseResponse(rawResponse as string);

      // 6. If it's artwork, perform deep analysis to enhance visual_elements
      if (result.workType.includes('绘画')) {
        console.log(
          `[QwenVL] Artwork detected: "${result.workType}", visual_elements count: ${result.visualElements.length}`
        );

        if (result.visualElements.length === 0) {
          console.log('[QwenVL] Starting deep artwork analysis...');
          try {
            const deepAnalysis = await this.deepAnalyzeArtwork(imageDataURL);
            // Merge deep analysis results
            result.visualElements = deepAnalysis.visualElements;
            console.log(
              `[QwenVL] Deep analysis found ${deepAnalysis.visualElements.length} visual elements:`,
              deepAnalysis.visualElements
            );

            if (deepAnalysis.detailedDescription) {
              result.description = deepAnalysis.detailedDescription;
            }
          } catch (error) {
            console.warn('[QwenVL] Deep artwork analysis failed, using basic result:', error);
            // Continue with basic result if deep analysis fails
          }
        } else {
          console.log(
            '[QwenVL] Basic analysis already found visual elements, skipping deep analysis'
          );
        }
      }

      return result;
    } catch (error) {
      // Handle specific errors
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new Error('OCR request timed out. Please try again.');
        }
        if (error.message.includes('rate limit')) {
          throw new Error('API rate limit exceeded. Please wait and try again.');
        }
        if (error.message.includes('401') || error.message.includes('403')) {
          throw new Error('Invalid ModelScope API key. Please check your configuration.');
        }
      }
      throw error;
    }
  }

  /**
   * Parse the JSON response from the model
   */
  private parseResponse(rawResponse: string): OCRResult {
    try {
      // Extract JSON from response (in case there's extra text)
      let jsonText = rawResponse.trim();

      // If response contains markdown code blocks, extract the JSON
      if (jsonText.includes('```json')) {
        const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          jsonText = match[1].trim();
        }
      } else if (jsonText.includes('```')) {
        const match = jsonText.match(/```\s*([\s\S]*?)\s*```/);
        if (match) {
          jsonText = match[1].trim();
        }
      }

      // Find JSON object in the response
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const data = JSON.parse(jsonText);

      // Validate and normalize the response
      return {
        studentName: (data.student_name || '').trim(),
        workType: data.work_type || '其他',
        description: data.description || '',
        textContent: data.text_content || '',
        keywords: Array.isArray(data.keywords) ? data.keywords : [],
        emotions: Array.isArray(data.emotions) ? data.emotions : [],
        visualElements: Array.isArray(data.visual_elements) ? data.visual_elements : [],
        rawResponse,
      };
    } catch (error) {
      console.error('Failed to parse OCR response:', error);
      console.error('Raw response:', rawResponse);

      // Return a fallback result
      return {
        studentName: '',
        workType: '其他',
        description: '解析失败',
        textContent: '',
        keywords: [],
        emotions: [],
        visualElements: [],
        rawResponse,
      };
    }
  }

  /**
   * Batch process multiple images
   *
   * @param imagePaths - Array of image file paths
   * @param onProgress - Optional progress callback
   * @returns Array of OCR results
   */
  async recognizeImages(
    imagePaths: string[],
    onProgress?: (current: number, total: number) => void
  ): Promise<OCRResult[]> {
    const results: OCRResult[] = [];

    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];

      try {
        const result = await this.recognizeImage(imagePath);
        results.push(result);

        if (onProgress) {
          onProgress(i + 1, imagePaths.length);
        }
      } catch (error) {
        console.error(`Failed to process image ${imagePath}:`, error);

        // Add error result
        results.push({
          studentName: '',
          workType: '其他',
          description: `处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
          textContent: '',
          keywords: [],
          emotions: [],
          visualElements: [],
        });

        if (onProgress) {
          onProgress(i + 1, imagePaths.length);
        }
      }
    }

    return results;
  }

  /**
   * Deep analysis for artwork (绘画专项深度分析)
   * This is automatically called for artwork if initial analysis lacks visual_elements
   *
   * @param imageDataURL - Base64 encoded image data URL
   * @returns Deep analysis result with detailed visual elements
   */
  private async deepAnalyzeArtwork(imageDataURL: string): Promise<{
    visualElements: string[];
    detailedDescription?: string;
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: ARTWORK_DEEP_ANALYSIS_PROMPT,
          },
          {
            type: 'image_url',
            image_url: {
              url: imageDataURL,
            },
          },
        ],
      },
    ];

    const response = await callModelScopeChat(messages, {
      model: this.model,
      temperature: 0.1,
      maxTokens: 1500, // More tokens for detailed analysis
    });

    const rawResponse = response.choices[0]?.message?.content;

    if (!rawResponse) {
      throw new Error('Empty response from deep analysis');
    }

    try {
      // Extract JSON from response
      let jsonText = (rawResponse as string).trim();

      if (jsonText.includes('```json')) {
        const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          jsonText = match[1].trim();
        }
      } else if (jsonText.includes('```')) {
        const match = jsonText.match(/```\s*([\s\S]*?)\s*```/);
        if (match) {
          jsonText = match[1].trim();
        }
      }

      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const data = JSON.parse(jsonText);

      return {
        visualElements: Array.isArray(data.visual_elements) ? data.visual_elements : [],
        detailedDescription: data.detailed_description || undefined,
      };
    } catch (error) {
      console.error('Failed to parse deep analysis response:', error);
      return {
        visualElements: [],
      };
    }
  }
}

/**
 * Create a singleton instance of QwenVLClient
 */
let globalClient: QwenVLClient | null = null;

export function getQwenVLClient(): QwenVLClient {
  if (!globalClient) {
    globalClient = new QwenVLClient();
  }
  return globalClient;
}
