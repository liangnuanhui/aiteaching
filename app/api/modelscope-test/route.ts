import { NextRequest } from 'next/server';
import { withApiHandler, withMiddleware } from '@/lib/api';
import { callModelScopeChat, getMessageContentText } from '@/lib/modelscope/client';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return withMiddleware(request, () =>
    withApiHandler(async () => {
      const result = await callModelScopeChat(
        [
          { role: 'system', content: '你是一个用于测试连通性的简短助手。' },
          {
            role: 'user',
            content: '请用一句话回复：“魔搭 API 已连接”。不要输出多余解释。',
          },
        ],
        {
          model: 'Qwen/Qwen3-Next-80B-A3B-Thinking',
          maxTokens: 64,
          temperature: 0.1,
        }
      );

      const content = getMessageContentText(result.choices[0]?.message.content);

      return {
        ok: true,
        model: result.model,
        reply: content,
      };
    })
  );
}
