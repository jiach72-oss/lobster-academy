/**
 * 龙虾学院 Blackbox SDK — 自定义 Agent 适配器
 * 适用于任何自定义 Agent 框架，提供通用录制接口
 */

import { Recorder } from '../src/recorder';
import { ToolCallRecord } from '../src/types';

/**
 * Agent 事件类型
 */
export type AgentEventType =
  | 'agent_start'
  | 'agent_think'
  | 'agent_tool_call'
  | 'agent_tool_result'
  | 'agent_output'
  | 'agent_error'
  | 'agent_end';

/**
 * Agent 事件
 */
export interface AgentEvent {
  type: AgentEventType;
  /** Agent名称/角色 */
  agentName?: string;
  /** 输入 */
  input?: Record<string, unknown>;
  /** 推理过程 */
  reasoning?: string;
  /** 输出 */
  output?: Record<string, unknown>;
  /** 工具调用 */
  toolCalls?: ToolCallRecord[];
  /** 耗时(ms) */
  duration?: number;
  /** 元数据 */
  metadata?: Record<string, string>;
}

/**
 * Agent 适配器
 * 
 * 适用于自定义 Agent 框架，提供事件驱动的录制接口。
 * 
 * @example
 * ```typescript
 * import { LobsterBlackbox } from '@lobster-academy/blackbox';
 * import { AgentAdapter } from '@lobster-academy/blackbox/plugins/custom';
 * 
 * const box = new LobsterBlackbox({ agentId: 'my-custom-agent' });
 * const adapter = new AgentAdapter(box.getRecorder());
 * 
 * // 在 Agent 的各个生命周期点调用
 * adapter.emit({
 *   type: 'agent_start',
 *   agentName: 'Researcher',
 *   input: { task: '调研竞品' },
 * });
 * 
 * // Agent 思考中...
 * adapter.emit({
 *   type: 'agent_think',
 *   reasoning: '需要先搜索相关信息...',
 * });
 * 
 * // Agent 调用工具
 * adapter.emit({
 *   type: 'agent_tool_call',
 *   toolCalls: [{ tool: 'web_search', params: { query: 'xxx' }, result: '...' }],
 * });
 * 
 * // Agent 输出
 * adapter.emit({
 *   type: 'agent_output',
 *   output: { answer: '调研结果如下...' },
 *   duration: 5000,
 * });
 * ```
 */
export class AgentAdapter {
  private recorder: Recorder;
  private sessionStart: number = Date.now();
  private eventCount: number = 0;

  constructor(recorder: Recorder) {
    this.recorder = recorder;
  }

  /**
   * 发送 Agent 事件
   */
  async emit(event: AgentEvent): Promise<void> {
    this.eventCount++;

    const recordType = event.type === 'agent_error' ? 'error' as const
      : event.type === 'agent_tool_call' || event.type === 'agent_tool_result'
        ? 'tool_call' as const
        : 'decision' as const;

    await this.recorder.record({
      type: recordType,
      input: {
        event: event.type,
        agentName: event.agentName,
        ...event.input,
      },
      reasoning: event.reasoning,
      output: event.output ?? {},
      toolCalls: event.toolCalls,
      duration: event.duration,
      metadata: {
        ...event.metadata,
        adapterEvent: event.type,
        eventIndex: String(this.eventCount),
      },
    });
  }

  /**
   * 便捷方法：记录 Agent 完整的一次执行
   */
  async recordExecution(options: {
    agentName: string;
    input: Record<string, unknown>;
    reasoning?: string;
    output: Record<string, unknown>;
    toolCalls?: ToolCallRecord[];
    duration: number;
    success?: boolean;
  }): Promise<void> {
    await this.emit({
      type: options.success !== false ? 'agent_output' : 'agent_error',
      agentName: options.agentName,
      input: options.input,
      reasoning: options.reasoning,
      output: options.output,
      toolCalls: options.toolCalls,
      duration: options.duration,
    });
  }

  /**
   * 获取已发送的事件数量
   */
  get count(): number {
    return this.eventCount;
  }

  /**
   * 获取会话时长(ms)
   */
  get sessionDuration(): number {
    return Date.now() - this.sessionStart;
  }

  /**
   * 重置会话计时器
   */
  resetSession(): void {
    this.sessionStart = Date.now();
    this.eventCount = 0;
  }
}

/**
 * 包装任意函数，自动录制执行
 * 
 * @example
 * ```typescript
 * const myAgentFn = wrapAgentFunction(
 *   recorder,
 *   'my-agent',
 *   async (input) => {
 *     // agent 逻辑
 *     return { answer: 'result' };
 *   }
 * );
 * 
 * const result = await myAgentFn({ question: '...' });
 * ```
 */
export function wrapAgentFunction<TInput extends Record<string, unknown>, TOutput extends Record<string, unknown>>(
  recorder: Recorder,
  agentName: string,
  fn: (input: TInput) => Promise<TOutput>,
  options?: { reasoning?: string }
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    const startTime = Date.now();
    const adapter = new AgentAdapter(recorder);

    try {
      const output = await fn(input);
      const duration = Date.now() - startTime;

      await adapter.recordExecution({
        agentName,
        input,
        reasoning: options?.reasoning ?? `${agentName} 执行完成`,
        output,
        duration,
        success: true,
      });

      return output;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;

      await adapter.recordExecution({
        agentName,
        input,
        reasoning: options?.reasoning ?? `${agentName} 执行出错`,
        output: { error: error instanceof Error ? error.message : String(error) },
        duration,
        success: false,
      });

      throw error;
    }
  };
}
