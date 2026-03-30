/**
 * 明镜 Blackbox SDK — CrewAI 插件
 * 自动拦截 CrewAI Agent 任务执行并录制到黑匣子
 */

import { Recorder } from '../src/recorder';
import { Redactor } from '../src/redactor';
import { Signer } from '../src/signer';

export interface CrewAIAgent {
  role: string;
  goal: string;
  backstory?: string;
}

export interface CrewAITask {
  description: string;
  expectedOutput: string;
  agent?: CrewAIAgent;
}

export interface CrewAICrewOptions {
  agents: CrewAIAgent[];
  tasks: CrewAITask[];
  verbose?: boolean;
  memory?: boolean;
}

// ─────────────────────────────────────────────
// 函数式 API（向后兼容）
// ─────────────────────────────────────────────

/**
 * 为 CrewAI Crew 添加黑匣子录制（函数式，向后兼容）
 * 
 * @example
 * ```typescript
 * import { Crew, Agent, Task } from 'crewai';
 * import { LobsterBlackbox } from '@lobster-academy/blackbox';
 * import { instrumentCrewAI } from '@lobster-academy/blackbox/plugins/crewai';
 * 
 * const box = new LobsterBlackbox({ agentId: 'my-crew' });
 * 
 * const crew = instrumentCrewAI(
 *   new Crew({ agents: [...], tasks: [...] }),
 *   box.getRecorder()
 * );
 * 
 * const result = await crew.kickoff();
 * // 所有 Agent 任务执行自动录制
 * ```
 */
export function instrumentCrewAI<T extends { kickoff: (...args: unknown[]) => Promise<unknown> }>(
  crew: T,
  recorder: Recorder
): T {
  const originalKickoff = crew.kickoff.bind(crew);

  crew.kickoff = async function(...args: unknown[]) {
    const startTime = Date.now();
    const params = args[0] as Record<string, unknown> | undefined;

    try {
      try {
        await recorder.record({
          type: 'system',
          input: { event: 'crew_start', inputs: params },
          reasoning: 'CrewAI Crew 开始执行',
          output: { status: 'started' },
          metadata: { framework: 'crewai' },
        });
      } catch (recordError) {
        console.error('[Blackbox] CrewAI recorder failed:', recordError);
      }

      const result = await originalKickoff(...args);
      const duration = Date.now() - startTime;

      try {
        await recorder.record({
          type: 'decision',
          input: { event: 'crew_complete', inputs: params },
          reasoning: 'CrewAI Crew 执行完成',
          output: {
            status: 'success',
            result: typeof result === 'string'
              ? result.substring(0, 500)
              : typeof result === 'object' && result !== null
                ? '[complex result]'
                : String(result),
          },
          toolCalls: [{
            tool: 'crewai.crew.kickoff',
            params: params ?? {},
            result: 'success',
            duration,
          }],
          duration,
          metadata: { framework: 'crewai' },
        });
      } catch (recordError) {
        console.error('[Blackbox] CrewAI recorder failed:', recordError);
      }

      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      try {
        await recorder.record({
          type: 'error',
          input: { event: 'crew_error' },
          reasoning: 'CrewAI Crew 执行出错',
          output: { error: errorMessage },
          duration,
          metadata: { framework: 'crewai' },
        });
      } catch (recordError) {
        console.error('[Blackbox] CrewAI recorder failed:', recordError);
      }

      throw error;
    }
  };

  return crew;
}

/**
 * 包装单个 Agent 以录制其行为（函数式，向后兼容）
 */
export function instrumentAgent<T extends { execute: (...args: unknown[]) => Promise<unknown> }>(
  agent: T,
  recorder: Recorder,
  agentInfo?: { role?: string; goal?: string }
): T {
  const originalExecute = agent.execute.bind(agent);

  agent.execute = async function(...args: unknown[]) {
    const startTime = Date.now();

    try {
      const result = await originalExecute(...args);
      const duration = Date.now() - startTime;

      try {
        await recorder.record({
          type: 'decision',
          input: {
            framework: 'crewai',
            event: 'agent_execute',
            role: agentInfo?.role,
          },
          reasoning: agentInfo?.goal ?? 'Agent 任务执行',
          output: {
            status: 'success',
            result: typeof result === 'string' ? result.substring(0, 500) : '[output]',
          },
          duration,
          metadata: { framework: 'crewai', agentRole: agentInfo?.role ?? 'unknown' },
        });
      } catch (recordError) {
        console.error('[Blackbox] CrewAI recorder failed:', recordError);
      }

      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;

      try {
        await recorder.record({
          type: 'error',
          input: { framework: 'crewai', event: 'agent_error' },
          output: { error: error instanceof Error ? error.message : String(error) },
          duration,
          metadata: { framework: 'crewai', agentRole: agentInfo?.role ?? 'unknown' },
        });
      } catch (recordError) {
        console.error('[Blackbox] CrewAI recorder failed:', recordError);
      }

      throw error;
    }
  };

  return agent;
}

// ─────────────────────────────────────────────
// 类式 API（增强版）
// ─────────────────────────────────────────────

/** CrewAI 插件配置 */
export interface CrewAIPluginConfig {
  /** Agent 唯一标识 */
  agentId: string;
  /** Ed25519 签名密钥（base64 编码） */
  signingKey?: string;
  /** 脱敏模式列表 */
  redactPatterns?: string[];
}

/**
 * CrewAI Agent 集成插件（增强版）
 *
 * 提供类式 API，自动拦截 CrewAI Crew 的任务执行和工具调用，
 * 支持自动脱敏和签名。
 *
 * @example
 * ```typescript
 * import { CrewAIPlugin } from '@lobster-academy/blackbox/plugins/crewai';
 *
 * const plugin = new CrewAIPlugin({
 *   agentId: 'my-crew-agent',
 *   signingKey: 'base64-key',
 * });
 *
 * const instrumentedCrew = plugin.wrapCrew(myCrew);
 * const result = await instrumentedCrew.kickoff();
 * ```
 */
export class CrewAIPlugin {
  private recorder: Recorder;
  private redactor: Redactor;
  private signer: Signer;
  private taskCount: number = 0;
  private errorCount: number = 0;

  constructor(config: CrewAIPluginConfig) {
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
   * 包装 Crew，自动录制任务执行
   *
   * @param crew CrewAI Crew 实例
   * @returns 包装后的 Crew 实例（同引用）
   */
  wrapCrew<T extends { kickoff: (...args: unknown[]) => Promise<unknown> }>(crew: T): T {
    const self = this;
    const originalKickoff = crew.kickoff.bind(crew);

    crew.kickoff = async function (...args: unknown[]) {
      const startTime = Date.now();
      const params = args[0] as Record<string, unknown> | undefined;

      try {
        // 前置拦截：记录 Crew 开始
        await self.recordEvent('system', 'crew_start', {
          inputs: params,
          status: 'started',
        });

        const result = await originalKickoff(...args);
        const duration = Date.now() - startTime;

        // 后置拦截：记录任务完成
        await self.interceptTask(
          { type: 'crew', inputs: params },
          typeof result === 'object' && result !== null
            ? result as Record<string, unknown>
            : { result: String(result) },
          duration,
        );

        return result;
      } catch (error: unknown) {
        const duration = Date.now() - startTime;
        self.errorCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);

        await self.recordEvent('error', 'crew_error', {
          error: errorMessage,
          duration,
        });

        throw error;
      }
    };

    // 包装 Crew 中的每个 Agent
    if (crew && typeof crew === 'object' && 'agents' in crew) {
      const agents = (crew as any).agents;
      if (Array.isArray(agents)) {
        for (let i = 0; i < agents.length; i++) {
          agents[i] = this.wrapAgent(agents[i]);
        }
      }
    }

    return crew;
  }

  /** 包装单个 Agent */
  private wrapAgent<T extends Record<string, unknown>>(agent: T): T {
    const self = this;
    const originalExecute = agent.execute || agent.run;
    if (typeof originalExecute !== 'function') return agent;

    (agent as any).execute = async function (...args: unknown[]) {
      const startTime = Date.now();
      try {
        const result = await (originalExecute as Function).apply(agent, args);
        const duration = Date.now() - startTime;

        await self.interceptTask(
          {
            type: 'agent_task',
            agentRole: (agent as any).role ?? 'unknown',
            agentGoal: (agent as any).goal,
          },
          typeof result === 'object' && result !== null ? result : { result: String(result) },
          duration,
        );

        return result;
      } catch (error: unknown) {
        self.errorCount++;
        await self.recordEvent('error', 'agent_error', {
          agentRole: (agent as any).role ?? 'unknown',
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };

    return agent;
  }

  /**
   * 拦截任务执行
   *
   * @param task 任务信息
   * @param result 执行结果
   * @param duration 耗时（ms）
   */
  private async interceptTask(
    task: { type: string; inputs?: Record<string, unknown>; agentRole?: string; agentGoal?: string },
    result: Record<string, unknown>,
    duration: number,
  ): Promise<void> {
    try {
      const safeResult = this.redactor.redactObject(result);

      await this.recorder.record({
        type: 'decision',
        input: {
          framework: 'crewai',
          event: 'task_complete',
          taskType: task.type,
          agentRole: task.agentRole,
        },
        reasoning: task.agentGoal ?? `CrewAI 任务完成: ${task.type}`,
        output: safeResult,
        toolCalls: [{
          tool: `crewai.${task.type}`,
          params: task.inputs ? this.redactor.redactObject(task.inputs) : {},
          result: 'success',
          duration,
        }],
        duration,
        metadata: { framework: 'crewai', agentRole: task.agentRole ?? 'unknown' },
      });

      this.taskCount++;
    } catch (e) {
      this.errorCount++;
      console.error('[Blackbox] CrewAI plugin record failed:', e);
    }
  }

  /**
   * 拦截工具调用
   *
   * @param tool 工具名称
   * @param params 调用参数
   * @param result 调用结果
   */
  private async interceptToolCall(
    tool: string,
    params: unknown,
    result: unknown,
  ): Promise<void> {
    try {
      const safeParams = typeof params === 'object' && params !== null
        ? this.redactor.redactObject(params as Record<string, unknown>)
        : { value: String(params) };

      await this.recorder.record({
        type: 'tool_call',
        input: { framework: 'crewai', tool, params: safeParams },
        reasoning: `CrewAI 工具调用: ${tool}`,
        output: typeof result === 'object' && result !== null
          ? this.redactor.redactObject(result as Record<string, unknown>)
          : { result: String(result) },
        toolCalls: [{
          tool: `crewai.${tool}`,
          params: safeParams,
          result: 'success',
        }],
        metadata: { framework: 'crewai' },
      });
    } catch (e) {
      this.errorCount++;
      console.error('[Blackbox] CrewAI plugin tool record failed:', e);
    }
  }

  /** 内部辅助：记录事件 */
  private async recordEvent(
    type: 'decision' | 'tool_call' | 'error' | 'system',
    event: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.recorder.record({
        type,
        input: { framework: 'crewai', event, ...data },
        reasoning: `CrewAI ${event}`,
        output: { status: event },
        metadata: { framework: 'crewai' },
      });
    } catch (e) {
      this.errorCount++;
    }
  }

  /**
   * 获取插件状态
   *
   * @returns 当前录制统计
   */
  getStatus(): { recorded: number; errors: number } {
    return { recorded: this.taskCount, errors: this.errorCount };
  }

  /** 获取底层录制器 */
  getRecorder(): Recorder {
    return this.recorder;
  }
}
