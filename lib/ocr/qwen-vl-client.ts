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

  /** 20-30 character description of the work */
  description: string;

  /** All text content extracted from the image */
  textContent: string;

  /** Keywords describing the work */
  keywords: string[];

  /** Emotional tags */
  emotions: string[];

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
  "description": "20-30字描述主题和特征",
  "text_content": "按顺序识别所有文字内容",
  "keywords": ["主题词", "视觉元素", "关键概念"],
  "emotions": ["快乐、温馨、思念、感恩、自豪、期待、创意、努力等"]
}

**分析指导:**
1. 绘画作品: 描述画面主体、色彩、风格
2. 手工作品: 描述材料、工艺、造型
3. 文字作品: 描述字体、排版、内容主题
4. 综合创作: 同时包含多种创作形式
5. 情感标签: 基于画面氛围、色彩、文字内容综合判断,可多选
6. 关键词: 提取3-5个核心概念词

**重要规则:**
- 只返回JSON对象,不要任何解释性文字
- student_name字段:如果照片中有手写姓名则识别,没有则返回空字符串""
- text_content字段:提取所有可见的文字内容(包括但不限于姓名)
- 所有字段都必须填写,不能省略`;

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

      return this.parseResponse(rawResponse as string);
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
        });

        if (onProgress) {
          onProgress(i + 1, imagePaths.length);
        }
      }
    }

    return results;
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
