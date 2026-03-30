/**
 * 明镜 Blackbox SDK — 通用中间件接口
 * 任何 Agent 框架都可以通过这个接口集成黑匣子录制
 */

import { Recorder } from '../src/recorder';
import { Signer } from '../src/signer';
import { BlackboxConfig, ToolCallRecord } from '../src/types';

/**
 * Agent 中间件接口
 *
 * 任何 Agent 框架都可以实现这个接口，通过生命周期钩子
 * 将决策过程录制到黑匣子中。
 *
 * @example
 * ```typescript
 * import { createMiddleware } from '@lobster-academy/blackbox/plugins/middleware';
 *
 * const middleware = createMiddleware({ agentId: 'my-agent' });
 *
 * // 在 Agent 执行流程中调用
 * const processedInput = await middleware.beforeExecute?.(input);
 * const result = await agent.run(processedInput);
 * await middleware.afterExecute?.(processedInput, result, duration);
 * ```
 */
export interface AgentMiddleware {
  /**
   * 前置处理：在 Agent 执行前调用
   * @param input Agent 输入
   * @returns 处理后的输入（可脱敏、增强等）
   */
  beforeExecute?(input: unknown): Promise<unknown>;

  /**
   * 后置处理：在 Agent 执行后调用
   * @param input 原始输入
   * @param output Agent 输出
   * @param duration 执行耗时（ms）
   */
  afterExecute?(input: unknown, output: unknown, duration: number): Promise<void>;

  /**
   * 工具调用拦截
   * @param tool 工具名称
   * @param params 调用参数
   * @param result 调用结果
   */
  onToolCall?(tool: string, params: unknown, result: unknown): Promise<void>;

  /**
   * 错误拦截
   * @param error 错误对象
   * @param context 错误上下文
   */
  onError?(error: Error, context: unknown): Promise<void>;
}

/** 中间件配置 */
export interface MiddlewareConfig {
  /** Agent 唯一标识 */
  agentId: string;
  /** 录制模式 */
  mode?: 'local' | 'cloud';
  /** 云端 API Key */
  apiKey?: string;
  /** Ed25519 签名密钥（base64 编码） */
  signingKey?: string;
  /** 脱敏模式列表 */
  redactPatterns?: string[];
  /** 最大记录数 */
  maxRecords?: number;
}

/**
 * 创建通用中间件
 *
 * 将黑匣子录制能力暴露为标准中间件接口，适用于任何 Agent 框架。
 *
 * @param config 中间件配置
 * @returns AgentMiddleware 实例
 *
 * @example
 * ```typescript
 * // 与任意 Agent 框架集成
 * const middleware = createMiddleware({
 *   agentId: 'my-agent',
 *   signingKey: 'base64-key',
 *   redactPatterns: ['email', 'phone'],
 * });
 *
 * // 框架只需调用这些钩子
 * await middleware.beforeExecute?.({ question: '...' });
 * // ... agent 执行 ...
 * await middleware.afterExecute?.(input, output, 1500);
 * ```
 */
export function createMiddleware(config: MiddlewareConfig): AgentMiddleware {
  const recorder = new Recorder({
    agentId: config.agentId,
    mode: config.mode,
    apiKey: config.apiKey,
    signingKey: config.signingKey,
    maxRecords: config.maxRecords,
    redact: config.redactPatterns ? { patterns: config.redactPatterns } : undefined,
  });

  const redactor = recorder.getRedactor();

  let eventCount = 0;

  return {
    async beforeExecute(input: unknown): Promise<unknown> {
      const safeInput = typeof input === 'object' && input !== null
        ? redactor.redactObject(input as Record<string, unknown>)
        : { value: String(input) };

      await recorder.record({
        type: 'system',
        input: { event: 'execute_start', data: safeInput },
        reasoning: 'Agent 开始执行',
        output: { status: 'started' },
        metadata: { middleware: 'true', eventIndex: String(eventCount++) },
      });

      // 返回脱敏后的输入供 Agent 使用
      return input;
    },

    async afterExecute(input: unknown, output: unknown, duration: number): Promise<void> {
      const safeInput = typeof input === 'object' && input !== null
        ? redactor.redactObject(input as Record<string, unknown>)
        : { value: String(input) };
      const safeOutput = typeof output === 'object' && output !== null
        ? redactor.redactObject(output as Record<string, unknown>)
        : { value: String(output) };

      await recorder.record({
        type: 'decision',
        input: { event: 'execute_complete', data: safeInput },
        reasoning: 'Agent 执行完成',
        output: safeOutput,
        duration,
        metadata: { middleware: 'true', eventIndex: String(eventCount++) },
      });
    },

    async onToolCall(tool: string, params: unknown, result: unknown): Promise<void> {
      const safeParams = typeof params === 'object' && params !== null
        ? redactor.redactObject(params as Record<string, unknown>)
        : { value: String(params) };
      const safeResult = typeof result === 'object' && result !== null
        ? redactor.redactObject(result as Record<string, unknown>)
        : { value: String(result) };

      const toolCall: ToolCallRecord = {
        tool,
        params: safeParams,
        result: typeof result === 'string' ? result.substring(0, 200) : '[complex]',
      };

      await recorder.record({
        type: 'tool_call',
        input: { event: 'tool_call', tool, params: safeParams },
        reasoning: `工具调用: ${tool}`,
        output: safeResult,
        toolCalls: [toolCall],
        metadata: { middleware: 'true', eventIndex: String(eventCount++) },
      });
    },

    async onError(error: Error, context: unknown): Promise<void> {
      const safeContext = typeof context === 'object' && context !== null
        ? redactor.redactObject(context as Record<string, unknown>)
        : { value: String(context) };

      await recorder.record({
        type: 'error',
        input: { event: 'error', context: safeContext },
        reasoning: `Agent 错误: ${error.message}`,
        output: {
          errorName: error.name,
          errorMessage: error.message,
          stack: error.stack?.substring(0, 500),
        },
        metadata: { middleware: 'true', eventIndex: String(eventCount++) },
      });
    },
  };
}

/**
 * 中间件包装器
 *
 * 将普通函数包装为带中间件生命周期的函数。
 *
 * @example
 * ```typescript
 * const middleware = createMiddleware({ agentId: 'my-agent' });
 *
 * const wrappedAgent = wrapWithMiddleware(
 *   async (input) => { return agent.run(input); },
 *   middleware
 * );
 *
 * const result = await wrappedAgent({ question: '...' });
 * ```
 */
export function wrapWithMiddleware<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput>,
  middleware: AgentMiddleware,
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    const startTime = Date.now();

    // 前置处理
    const processedInput = middleware.beforeExecute
      ? await middleware.beforeExecute(input)
      : input;

    try {
      const output = await fn(processedInput as TInput);
      const duration = Date.now() - startTime;

      // 后置处理
      if (middleware.afterExecute) {
        await middleware.afterExecute(input, output, duration);
      }

      return output;
    } catch (error: unknown) {
      // 错误处理
      if (middleware.onError && error instanceof Error) {
        await middleware.onError(error, { input, duration: Date.now() - startTime });
      }
      throw error;
    }
  };
}
