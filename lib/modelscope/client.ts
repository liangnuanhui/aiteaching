/**
 * ModelScope (魔搭社区) API client
 *
 * This wrapper calls the OpenAI-compatible HTTP API exposed by ModelScope.
 * - Base URL: https://api-inference.modelscope.cn/v1
 * - Model: use the provided model id, e.g. "ms-bf630ca3-8bfe-4ffe-a3b0-caa14606ea97"
 *
 * SECURITY:
 * - Never hardcode the API key.
 * - Put your key in MODELSCOPE_API_KEY in .env.local.
 */

import { getEnv } from '@/lib/config/env';

const MODELSCOPE_BASE_URL = 'https://api-inference.modelscope.cn/v1';

export type MessageContent =
  | string
  | Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: {
        url: string;
      };
    }>;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string | null;
  }>;
}

/**
 * Call ModelScope chat completion API with the given messages.
 */
export async function callModelScopeChat(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResponse> {
  const apiKey = getEnv('MODELSCOPE_API_KEY');
  const timeoutMs = 60000;

  if (!apiKey) {
    throw new Error(
      'MODELSCOPE_API_KEY is not configured. Please set it in .env.local before calling ModelScope.'
    );
  }

  const envModelId = getEnv('MODELSCOPE_MODEL_ID');
  const model = options.model ?? envModelId ?? 'Qwen/Qwen3-Next-80B-A3B-Thinking';

  const controller = new AbortController();

  const fetchPromise = fetch(`${MODELSCOPE_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 5000,
    }),
    signal: controller.signal,
  });

  let timer: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`ModelScope request timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);
  });

  const response = (await Promise.race([fetchPromise, timeoutPromise])) as Response;

  if (timer) {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ModelScope API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  return data;
}

/**
 * Normalize assistant message content to plain text for downstream parsing.
 */
export function getMessageContentText(content: MessageContent | undefined): string {
  if (!content) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  return content
    .map(part => {
      if (part.type === 'text') {
        return part.text ?? '';
      }
      if (part.type === 'image_url') {
        return part.image_url?.url ?? '';
      }
      return '';
    })
    .join('\n');
}
