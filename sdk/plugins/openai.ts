/**
 * 龙虾学院 Blackbox SDK — OpenAI 插件
 * 自动拦截 OpenAI API 调用并录制到黑匣子
 */

import { Recorder } from '../src/recorder';

/** 安全提取消息内容：先脱敏再截断 */
function extractMessages(messages: Array<{ role: string; content: string | unknown[] }> | undefined, redactor: { redactString(text: string): string }): Array<{ role: string; content: string }> {
  if (!messages) return [];
  return messages.map(m => ({
    role: m.role,
    content: typeof m.content === 'string'
      ? redactor.redactString(m.content).substring(0, 500)
      : '[non-text]',
  }));
}

export interface OpenAIClient {
  chat: {
    completions: {
      create: (...args: unknown[]) => Promise<unknown>;
    };
  };
}

/**
 * 为 OpenAI 客户端添加黑匣子录制
 * 
 * @example
 * ```typescript
 * import OpenAI from 'openai';
 * import { LobsterBlackbox } from '@lobster-academy/blackbox';
 * import { instrumentOpenAI } from '@lobster-academy/blackbox/plugins/openai';
 * 
 * const box = new LobsterBlackbox({ agentId: 'my-agent' });
 * const openai = new OpenAI({ apiKey: '...' });
 * const instrumented = instrumentOpenAI(openai, box.getRecorder());
 * 
 * // 之后所有调用自动录制
 * await instrumented.chat.completions.create({ model: 'gpt-4', messages: [...] });
 * ```
 */
export function instrumentOpenAI<T extends OpenAIClient>(
  client: T,
  recorder: Recorder
): T {
  const originalCreate = client.chat.completions.create.bind(client.chat.completions);

  client.chat.completions.create = async function(...args: unknown[]) {
    const startTime = Date.now();
    const params = args[0] as Record<string, unknown>;
    
    try {
      const result = await originalCreate(...args);
      const duration = Date.now() - startTime;

      try {
        await recorder.record({
          type: 'decision',
          input: {
            model: params?.model,
            messages: extractMessages(
              params?.messages as Array<{ role: string; content: string | unknown[] }>,
              recorder.getRedactor()
            ),
          },
          reasoning: 'OpenAI chat completion',
          output: {
            status: 'success',
            usage: (result as Record<string, unknown>)?.usage,
          },
          toolCalls: [{
            tool: 'openai.chat.completions.create',
            params: { model: params?.model },
            result: 'success',
            duration,
          }],
          duration,
        });
      } catch (recordError) {
        console.error('[Blackbox] OpenAI recorder failed:', recordError);
      }

      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      try {
        await recorder.record({
          type: 'error',
          input: { model: params?.model },
          output: { error: errorMessage },
          toolCalls: [{
            tool: 'openai.chat.completions.create',
            params: { model: params?.model },
            result: 'error',
            error: errorMessage,
            duration,
          }],
          duration,
        });
      } catch (recordError) {
        console.error('[Blackbox] OpenAI recorder failed:', recordError);
      }

      throw error;
    }
  } as typeof client.chat.completions.create;

  return client;
}
