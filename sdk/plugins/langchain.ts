/**
 * 龙虾学院 Blackbox SDK — LangChain 插件
 * 自动拦截 LangChain Chain/Agent 调用并录制到黑匣子
 */

import { Recorder } from '../src/recorder';

export interface LangChainCallbacks {
  handleLLMStart?: (llm: unknown, prompts: string[], runId: string, parentRunId?: string) => void;
  handleLLMEnd?: (output: unknown, runId: string) => void;
  handleLLMError?: (err: Error, runId: string) => void;
  handleChainStart?: (chain: unknown, inputs: Record<string, unknown>, runId: string) => void;
  handleChainEnd?: (outputs: Record<string, unknown>, runId: string) => void;
  handleChainError?: (err: Error, runId: string) => void;
  handleToolStart?: (tool: unknown, input: string, runId: string) => void;
  handleToolEnd?: (output: string, runId: string) => void;
  handleToolError?: (err: Error, runId: string) => void;
}

/**
 * 创建 LangChain 回调处理器
 * 
 * @example
 * ```typescript
 * import { ChatOpenAI } from '@langchain/openai';
 * import { LobsterBlackbox } from '@lobster-academy/blackbox';
 * import { createLangChainCallbacks } from '@lobster-academy/blackbox/plugins/langchain';
 * 
 * const box = new LobsterBlackbox({ agentId: 'my-chain' });
 * const callbacks = createLangChainCallbacks(box.getRecorder());
 * 
 * const model = new ChatOpenAI({ callbacks: [callbacks] });
 * ```
 */
export function createLangChainCallbacks(recorder: Recorder): LangChainCallbacks {
  const runStartTimes = new Map<string, number>();

  /** 清理超时未完成的 run（防内存泄漏） */
  const cleanupTimeout = 300_000; // 5分钟超时清理
  function cleanStale() {
    const now = Date.now();
    for (const [id, start] of runStartTimes) {
      if (now - start > cleanupTimeout) {
        runStartTimes.delete(id);
      }
    }
  }

  function getAndDelete(runId: string): number {
    const start = runStartTimes.get(runId) ?? Date.now();
    runStartTimes.delete(runId);
    return Date.now() - start;
  }

  return {
    // --- LLM ---
    handleLLMStart(llm, prompts, runId) {
      cleanStale(); runStartTimes.set(runId, Date.now());
    },

    async handleLLMEnd(output, runId) {
      const duration = getAndDelete(runId);

      try {
        await recorder.record({
          type: 'decision',
          input: { framework: 'langchain', step: 'llm' },
          reasoning: 'LangChain LLM 调用完成',
          output: {
            generations: (output as Record<string, unknown>)?.generations
              ? '[generations recorded]'
              : '[output recorded]',
          },
          toolCalls: [{
            tool: 'langchain.llm',
            params: {},
            result: 'success',
            duration,
          }],
          duration,
        });
      } catch (recordError) {
        console.error('[Blackbox] LangChain recorder failed:', recordError);
      }
    },

    async handleLLMError(err, runId) {
      const duration = getAndDelete(runId);

      try {
        await recorder.record({
          type: 'error',
          input: { framework: 'langchain', step: 'llm' },
          output: { error: err.message },
          duration,
        });
      } catch (recordError) {
        console.error('[Blackbox] LangChain recorder failed:', recordError);
      }
    },

    // --- Chain ---
    handleChainStart(chain, inputs, runId) {
      runStartTimes.set(runId, Date.now());
    },

    async handleChainEnd(outputs, runId) {
      const duration = getAndDelete(runId);

      try {
        await recorder.record({
          type: 'decision',
          input: { framework: 'langchain', step: 'chain' },
          reasoning: 'LangChain Chain 执行完成',
          output: recorder.getRedactor().redactObject(outputs),
          toolCalls: [{
            tool: 'langchain.chain',
            params: {},
            result: 'success',
            duration,
          }],
          duration,
        });
      } catch (recordError) {
        console.error('[Blackbox] LangChain recorder failed:', recordError);
      }
    },

    async handleChainError(err, runId) {
      const duration = getAndDelete(runId);

      try {
        await recorder.record({
          type: 'error',
          input: { framework: 'langchain', step: 'chain' },
          output: { error: err.message },
          duration,
        });
      } catch (recordError) {
        console.error('[Blackbox] LangChain recorder failed:', recordError);
      }
    },

    // --- Tool ---
    handleToolStart(tool, input, runId) {
      runStartTimes.set(runId, Date.now());
    },

    async handleToolEnd(output, runId) {
      const duration = getAndDelete(runId);

      try {
        await recorder.record({
          type: 'tool_call',
          input: { framework: 'langchain', step: 'tool' },
          reasoning: 'LangChain Tool 调用完成',
          output: { result: typeof output === 'string' ? output.substring(0, 500) : '[complex output]' },
          toolCalls: [{
            tool: 'langchain.tool',
            params: {},
            result: typeof output === 'string' ? output.substring(0, 200) : '[output]',
            duration,
          }],
          duration,
        });
      } catch (recordError) {
        console.error('[Blackbox] LangChain recorder failed:', recordError);
      }
    },

    async handleToolError(err, runId) {
      const duration = getAndDelete(runId);

      try {
        await recorder.record({
          type: 'error',
          input: { framework: 'langchain', step: 'tool' },
          output: { error: err.message },
          duration,
        });
      } catch (recordError) {
        console.error('[Blackbox] LangChain recorder failed:', recordError);
      }
    },
  };
}
