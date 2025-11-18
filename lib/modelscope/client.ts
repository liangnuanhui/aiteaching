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

import type { NextRequest } from 'next/server';
import { getEnv } from '@/lib/config/env';

const MODELSCOPE_BASE_URL = 'https://api-inference.modelscope.cn/v1';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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

  if (!apiKey) {
    throw new Error(
      'MODELSCOPE_API_KEY is not configured. Please set it in .env.local before calling ModelScope.'
    );
  }

  const model = options.model ?? 'ms-bf630ca3-8bfe-4ffe-a3b0-caa14606ea97';

  const response = await fetch(`${MODELSCOPE_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ModelScope API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  return data;
}
