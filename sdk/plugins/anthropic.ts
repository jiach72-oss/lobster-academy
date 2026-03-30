/**
 * 明镜 Blackbox SDK — Anthropic 插件
 * 自动拦截 Anthropic Claude API 调用并录制到黑匣子
 */

import { Recorder } from '../src/recorder';

/** 安全提取消息内容：先脱敏再截断 */
function extractMessages(messages: Array<{ role: string; content: string | unknown[] }> | undefined, redactor: { redactString(text: string): string }): Array<{ role: string; content: string }> {
  if (!messages) return [];
  return messages.map(m => ({
    role: m.role,
    content: typeof m.content === 'string'
      ? redactor.redactString(m.content).substring(0, 500)
      : '[multi-modal content]',
  }));
}

/** 安全提取 system 字段：先脱敏再截断 */
function extractSystem(system: unknown, redactor: { redactString(text: string): string }): string | undefined {
  if (typeof system !== 'string') return undefined;
  return redactor.redactString(system).substring(0, 200);
}

export interface AnthropicClient {
  messages: {
    create: (...args: unknown[]) => Promise<unknown>;
  };
}

/**
 * 为 Anthropic 客户端添加黑匣子录制
 *
 * @example
 * ```typescript
 * import Anthropic from '@anthropic-ai/sdk';
 * import { LobsterBlackbox } from '@lobster-academy/blackbox';
 * import { instrumentAnthropic } from '@lobster-academy/blackbox/plugins/anthropic';
 *
 * const box = new LobsterBlackbox({ agentId: 'my-agent' });
 * const anthropic = new Anthropic({ apiKey: '...' });
 * const instrumented = instrumentAnthropic(anthropic, box.getRecorder());
 *
 * // 之后所有调用自动录制
 * await instrumented.messages.create({ model: 'claude-sonnet-4-20250514', messages: [...] });
 * ```
 */
export function instrumentAnthropic<T extends AnthropicClient>(
  client: T,
  recorder: Recorder
): T {
  const originalCreate = client.messages.create.bind(client.messages);

  client.messages.create = async function(...args: unknown[]) {
    const startTime = Date.now();
    const params = args[0] as Record<string, unknown> | undefined;

    try {
      const result = await originalCreate(...args);
      const duration = Date.now() - startTime;

      // 提取 usage 信息
      const usage = (result as Record<string, unknown>)?.usage as Record<string, unknown> | undefined;

      try {
        await recorder.record({
          type: 'decision',
          input: {
            model: params?.model,
            max_tokens: params?.max_tokens,
            messages: extractMessages(
              params?.messages as Array<{ role: string; content: string | unknown[] }>,
              recorder.getRedactor()
            ),
            system: extractSystem(params?.system, recorder.getRedactor()),
          },
          reasoning: 'Anthropic Claude completion',
          output: {
            status: 'success',
            stop_reason: (result as Record<string, unknown>)?.stop_reason,
            usage: usage ? {
              input_tokens: usage.input_tokens,
              output_tokens: usage.output_tokens,
            } : undefined,
          },
          toolCalls: [{
            tool: 'anthropic.messages.create',
            params: { model: params?.model, max_tokens: params?.max_tokens },
            result: 'success',
            duration,
          }],
          duration,
        });
      } catch (recordError) {
        console.error('[Blackbox] Anthropic recorder failed:', recordError);
      }

      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      try {
        await recorder.record({
          type: 'error',
          input: {
            model: params?.model,
            max_tokens: params?.max_tokens,
          },
          output: { error: errorMessage },
          toolCalls: [{
            tool: 'anthropic.messages.create',
            params: { model: params?.model },
            result: 'error',
            error: errorMessage,
            duration,
          }],
          duration,
        });
      } catch (recordError) {
        console.error('[Blackbox] Anthropic recorder failed:', recordError);
      }

      throw error;
    }
  } as typeof client.messages.create;

  return client;
}
