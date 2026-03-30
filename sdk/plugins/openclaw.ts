/**
 * 明镜 Blackbox SDK — OpenClaw Agent 集成插件
 * 自动拦截 OpenClaw Agent 的 LLM 调用和工具调用
 */

import { Recorder } from '../src/recorder';
import { Redactor } from '../src/redactor';
import { Signer } from '../src/signer';

/** OpenClaw 插件配置 */
export interface OpenClawPluginConfig {
  /** Agent 唯一标识 */
  agentId: string;
  /** Ed25519 签名密钥（base64 编码） */
  signingKey?: string;
  /** 脱敏模式列表 */
  redactPatterns?: string[];
}

/** 插件运行状态 */
export interface OpenClawPluginStatus {
  /** 已录制事件数 */
  recorded: number;
  /** 录制错误数 */
  errors: number;
  /** 最后一条记录的时间戳 */
  lastRecord: string | null;
}

/**
 * OpenClaw Agent 集成插件
 *
 * 自动拦截 OpenClaw Agent 的 LLM 调用和工具调用，录制到黑匣子。
 *
 * @example
 * ```typescript
 * import { OpenClawPlugin } from '@lobster-academy/blackbox/plugins/openclaw';
 *
 * const plugin = new OpenClawPlugin({
 *   agentId: 'my-openclaw-agent',
 *   signingKey: 'base64-encoded-key',
 * });
 *
 * // 包装 Agent 实例
 * const instrumentedAgent = plugin.wrap(myAgent);
 *
 * // 之后所有 LLM 和工具调用自动录制
 * await instrumentedAgent.execute(input);
 * ```
 */
export class OpenClawPlugin {
  private recorder: Recorder;
  private redactor: Redactor;
  private signer: Signer;
  private recordedCount: number = 0;
  private errorCount: number = 0;
  private lastRecordTime: string | null = null;
  private runStartTimes: Map<string, number> = new Map();

  constructor(config: OpenClawPluginConfig) {
    if (!config.agentId || typeof config.agentId !== 'string') {
      throw new TypeError('agentId is required');
    }
    this.recorder = new Recorder({
      agentId: config.agentId,
      signingKey: config.signingKey,
      redact: config.redactPatterns ? { patterns: config.redactPatterns } : undefined,
    });
    this.redactor = this.recorder.getRedactor();
    this.signer = new Signer(config.signingKey);
  }

  /**
   * 包装 Agent，自动录制所有决策
   *
   * 拦截 Agent 的 `execute`/`run`/`invoke` 方法，
   * 自动录制 LLM 调用和工具调用。
   *
   * @param agent 原始 Agent 实例
   * @returns 包装后的 Agent 实例（同引用）
   */
  wrap<T extends Record<string, unknown>>(agent: T): T {
    const self = this;
    const methodNames = ['execute', 'run', 'invoke', 'call'] as const;

    for (const method of methodNames) {
      const original = agent[method];
      if (typeof original !== 'function') continue;

      (agent as any)[method] = async function (...args: unknown[]) {
        const callId = `${method}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const startTime = Date.now();
        self.runStartTimes.set(callId, startTime);

        try {
          // 拦截前置：记录 Agent 开始执行
          await self.recordAgentEvent('start', {
            method,
            input: args[0],
          });

          const result = await (original as Function).apply(agent, args);
          const duration = Date.now() - startTime;

          // 拦截后置：记录 LLM 调用完成
          await self.interceptLLMCall(
            args[0],
            typeof result === 'object' && result !== null ? result : { result },
            duration,
          );

          self.runStartTimes.delete(callId);
          return result;
        } catch (error: unknown) {
          const duration = Date.now() - startTime;
          self.errorCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);

          await self.recordAgentEvent('error', {
            method,
            error: errorMessage,
            duration,
          });

          self.runStartTimes.delete(callId);
          throw error;
        }
      };
    }

    // 拦截工具调用（如果有 tools 属性）
    if (agent && typeof agent === 'object' && 'tools' in agent) {
      const tools = (agent as any).tools;
      if (Array.isArray(tools)) {
        (agent as any).tools = tools.map((tool: Record<string, unknown>) => self.wrapTool(tool));
      }
    }

    return agent;
  }

  /** 包装单个工具 */
  private wrapTool<T extends Record<string, unknown>>(tool: T): T {
    const self = this;
    const originalExecute = tool.execute || tool.run || tool.call;
    if (typeof originalExecute !== 'function') return tool;

    (tool as any).execute = async function (params: unknown) {
      const startTime = Date.now();
      try {
        const result = await (originalExecute as Function).call(tool, params);
        const duration = Date.now() - startTime;
        await self.interceptToolCall(
          (tool as any).name ?? 'unknown',
          params,
          result,
          duration,
        );
        return result;
      } catch (error: unknown) {
        const duration = Date.now() - startTime;
        self.errorCount++;
        await self.interceptToolCall(
          (tool as any).name ?? 'unknown',
          params,
          { error: error instanceof Error ? error.message : String(error) },
          duration,
        );
        throw error;
      }
    };

    return tool;
  }

  /**
   * 拦截 LLM 调用
   *
   * @param input LLM 输入
   * @param output LLM 输出
   * @param duration 耗时（ms）
   */
  private async interceptLLMCall(
    input: unknown,
    output: unknown,
    duration: number,
  ): Promise<void> {
    try {
      const safeInput = typeof input === 'object' && input !== null
        ? this.redactor.redactObject(input as Record<string, unknown>)
        : { value: String(input) };

      const safeOutput = typeof output === 'object' && output !== null
        ? this.redactor.redactObject(output as Record<string, unknown>)
        : { value: String(output) };

      await this.recorder.record({
        type: 'decision',
        input: { framework: 'openclaw', event: 'llm_call', ...safeInput },
        reasoning: 'OpenClaw Agent LLM 调用',
        output: safeOutput,
        duration,
        toolCalls: [{
          tool: 'openclaw.llm',
          params: {},
          result: 'success',
          duration,
        }],
        metadata: { framework: 'openclaw' },
      });

      this.recordedCount++;
      this.lastRecordTime = new Date().toISOString();
    } catch (e) {
      this.errorCount++;
      console.error('[Blackbox] OpenClaw plugin record failed:', e);
    }
  }

  /**
   * 拦截工具调用
   *
   * @param tool 工具名称
   * @param params 调用参数
   * @param result 调用结果
   * @param duration 耗时（ms）
   */
  private async interceptToolCall(
    tool: string,
    params: unknown,
    result: unknown,
    duration: number,
  ): Promise<void> {
    try {
      const safeParams = typeof params === 'object' && params !== null
        ? this.redactor.redactObject(params as Record<string, unknown>)
        : { value: String(params) };

      await this.recorder.record({
        type: 'tool_call',
        input: { framework: 'openclaw', tool, params: safeParams },
        reasoning: `OpenClaw 工具调用: ${tool}`,
        output: typeof result === 'object' && result !== null
          ? this.redactor.redactObject(result as Record<string, unknown>)
          : { result: String(result) },
        toolCalls: [{
          tool: `openclaw.${tool}`,
          params: safeParams,
          result: 'success',
          duration,
        }],
        duration,
        metadata: { framework: 'openclaw' },
      });

      this.recordedCount++;
      this.lastRecordTime = new Date().toISOString();
    } catch (e) {
      this.errorCount++;
      console.error('[Blackbox] OpenClaw plugin tool record failed:', e);
    }
  }

  /** 内部辅助：记录 Agent 事件 */
  private async recordAgentEvent(
    event: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.recorder.record({
        type: event === 'error' ? 'error' : 'system',
        input: { framework: 'openclaw', event, ...data },
        reasoning: `OpenClaw Agent ${event}`,
        output: { status: event },
        metadata: { framework: 'openclaw' },
      });
    } catch (e) {
      this.errorCount++;
      console.error('[Blackbox] OpenClaw plugin event record failed:', e);
    }
  }

  /**
   * 获取插件状态
   *
   * @returns 当前录制统计
   */
  getStatus(): OpenClawPluginStatus {
    return {
      recorded: this.recordedCount,
      errors: this.errorCount,
      lastRecord: this.lastRecordTime,
    };
  }

  /** 获取底层录制器 */
  getRecorder(): Recorder {
    return this.recorder;
  }
}
