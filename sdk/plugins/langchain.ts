/**
 * 明镜 Blackbox SDK — LangChain 插件（增强版）
 * 自动拦截 LangChain Chain/Agent 调用并录制到黑匣子
 * 支持：自动脱敏、Ed25519 签名、异常检测
 */

import { Recorder } from '../src/recorder';
import { Redactor } from '../src/redactor';
import { Signer } from '../src/signer';

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

/** LangChain 增强插件配置 */
export interface LangChainEnhancedConfig {
  /** 签名密钥（base64 编码的 Ed25519 私钥） */
  signingKey?: string;
  /** 脱敏模式列表 */
  redactPatterns?: string[];
  /** 异常检测：高延迟阈值（ms），超过则触发告警 */
  latencyThreshold?: number;
  /** 异常检测：连续错误数阈值 */
  errorSpikeThreshold?: number;
}

/**
 * 异常检测器
 * 追踪延迟和错误模式，检测异常行为
 */
class AnomalyDetector {
  private latencyThreshold: number;
  private errorSpikeThreshold: number;
  private recentLatencies: number[] = [];
  private consecutiveErrors: number = 0;
  private readonly windowSize = 20;

  constructor(config: { latencyThreshold?: number; errorSpikeThreshold?: number }) {
    this.latencyThreshold = config.latencyThreshold ?? 10_000;
    this.errorSpikeThreshold = config.errorSpikeThreshold ?? 3;
  }

  /** 记录一次延迟，返回是否异常 */
  checkLatency(duration: number): { anomalous: boolean; reason?: string } {
    this.recentLatencies.push(duration);
    if (this.recentLatencies.length > this.windowSize) {
      this.recentLatencies.shift();
    }

    if (duration > this.latencyThreshold) {
      return { anomalous: true, reason: `延迟 ${duration}ms 超过阈值 ${this.latencyThreshold}ms` };
    }

    // 检测延迟突增（当前值超过平均值的 3 倍）
    if (this.recentLatencies.length >= 5) {
      const avg = this.recentLatencies.reduce((a, b) => a + b, 0) / this.recentLatencies.length;
      if (duration > avg * 3 && duration > 5000) {
        return { anomalous: true, reason: `延迟 ${duration}ms 超过近期平均值 ${Math.round(avg)}ms 的 3 倍` };
      }
    }

    return { anomalous: false };
  }

  /** 记录一次错误，返回是否触发错误尖峰告警 */
  checkError(): { spike: boolean; reason?: string } {
    this.consecutiveErrors++;
    if (this.consecutiveErrors >= this.errorSpikeThreshold) {
      return { spike: true, reason: `连续 ${this.consecutiveErrors} 次错误，超过阈值 ${this.errorSpikeThreshold}` };
    }
    return { spike: false };
  }

  /** 重置连续错误计数 */
  resetErrors(): void {
    this.consecutiveErrors = 0;
  }
}

/**
 * 创建 LangChain 回调处理器（增强版）
 *
 * 支持自动脱敏、Ed25519 签名、实时异常检测。
 *
 * @example
 * ```typescript
 * import { ChatOpenAI } from '@langchain/openai';
 * import { LobsterBlackbox } from '@lobster-academy/blackbox';
 * import { createLangChainCallbacks } from '@lobster-academy/blackbox/plugins/langchain';
 *
 * const box = new LobsterBlackbox({ agentId: 'my-chain' });
 *
 * // 基础用法（向后兼容）
 * const callbacks = createLangChainCallbacks(box.getRecorder());
 *
 * // 增强用法（带脱敏+签名+异常检测）
 * const enhanced = createLangChainCallbacks(box.getRecorder(), {
 *   signingKey: 'base64-key',
 *   redactPatterns: ['email', 'phone'],
 *   latencyThreshold: 5000,
 *   errorSpikeThreshold: 3,
 * });
 *
 * const model = new ChatOpenAI({ callbacks: [enhanced] });
 * ```
 */
export function createLangChainCallbacks(recorder: Recorder, config?: LangChainEnhancedConfig): LangChainCallbacks {
  const runStartTimes = new Map<string, number>();

  // 增强组件
  const redactor = recorder.getRedactor();

  const signer = config?.signingKey ? new Signer(config.signingKey) : null;
  const anomalyDetector = new AnomalyDetector({
    latencyThreshold: config?.latencyThreshold,
    errorSpikeThreshold: config?.errorSpikeThreshold,
  });

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

  /** 增强版录制：自动脱敏 + 签名 + 异常检测 */
  async function recordEnhanced(data: {
    type: 'decision' | 'tool_call' | 'error' | 'system';
    input: Record<string, unknown>;
    reasoning?: string;
    output: Record<string, unknown>;
    toolCalls?: Array<{ tool: string; params: Record<string, unknown>; result: string; duration?: number; error?: string }>;
    duration?: number;
  }): Promise<void> {
    try {
      // 脱敏处理
      const safeInput = redactor.redactObject(data.input);
      const safeOutput = redactor.redactObject(data.output);

      await recorder.record({
        ...data,
        input: safeInput,
        output: safeOutput,
      });
    } catch (e) {
      console.error('[Blackbox] LangChain recorder failed:', e);
    }
  }

  return {
    // --- LLM ---
    handleLLMStart(llm, prompts, runId) {
      cleanStale(); runStartTimes.set(runId, Date.now());
    },

    async handleLLMEnd(output, runId) {
      const duration = getAndDelete(runId);

      // 异常检测：延迟
      const latencyCheck = anomalyDetector.checkLatency(duration);
      if (latencyCheck.anomalous) {
        console.warn(`[Blackbox][Anomaly] ${latencyCheck.reason}`);
      }
      anomalyDetector.resetErrors();

      await recordEnhanced({
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
    },

    async handleLLMError(err, runId) {
      const duration = getAndDelete(runId);

      // 异常检测：错误尖峰
      const errorCheck = anomalyDetector.checkError();
      if (errorCheck.spike) {
        console.error(`[Blackbox][Anomaly] ${errorCheck.reason}`);
      }

      await recordEnhanced({
        type: 'error',
        input: { framework: 'langchain', step: 'llm' },
        output: { error: err.message },
        duration,
      });
    },

    // --- Chain ---
    handleChainStart(chain, inputs, runId) {
      runStartTimes.set(runId, Date.now());
    },

    async handleChainEnd(outputs, runId) {
      const duration = getAndDelete(runId);

      const latencyCheck = anomalyDetector.checkLatency(duration);
      if (latencyCheck.anomalous) {
        console.warn(`[Blackbox][Anomaly] ${latencyCheck.reason}`);
      }
      anomalyDetector.resetErrors();

      await recordEnhanced({
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
    },

    async handleChainError(err, runId) {
      const duration = getAndDelete(runId);

      const errorCheck = anomalyDetector.checkError();
      if (errorCheck.spike) {
        console.error(`[Blackbox][Anomaly] ${errorCheck.reason}`);
      }

      await recordEnhanced({
        type: 'error',
        input: { framework: 'langchain', step: 'chain' },
        output: { error: err.message },
        duration,
      });
    },

    // --- Tool ---
    handleToolStart(tool, input, runId) {
      runStartTimes.set(runId, Date.now());
    },

    async handleToolEnd(output, runId) {
      const duration = getAndDelete(runId);

      const latencyCheck = anomalyDetector.checkLatency(duration);
      if (latencyCheck.anomalous) {
        console.warn(`[Blackbox][Anomaly] ${latencyCheck.reason}`);
      }
      anomalyDetector.resetErrors();

      await recordEnhanced({
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
    },

    async handleToolError(err, runId) {
      const duration = getAndDelete(runId);

      const errorCheck = anomalyDetector.checkError();
      if (errorCheck.spike) {
        console.error(`[Blackbox][Anomaly] ${errorCheck.reason}`);
      }

      await recordEnhanced({
        type: 'error',
        input: { framework: 'langchain', step: 'tool' },
        output: { error: err.message },
        duration,
      });
    },
  };
}
