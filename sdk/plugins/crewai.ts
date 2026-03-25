/**
 * 龙虾学院 Blackbox SDK — CrewAI 插件
 * 自动拦截 CrewAI Agent 任务执行并录制到黑匣子
 */

import { Recorder } from '../src/recorder';

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

/**
 * 为 CrewAI Crew 添加黑匣子录制
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
 * 包装单个 Agent 以录制其行为
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
