/**
 * MirrorAI Interceptor — 自动拦截 LLM 调用和工具调用
 * 包装原始函数，自动录制决策而不需要用户手动调用 record()
 */

import { Recorder } from './recorder';
import { Guard } from './guard';
import { Shield } from './shield';
import { Gate, ToolCall } from './gate';

export interface InterceptorConfig {
  // 是否启用输入过滤
  enableGuard: boolean;
  // 是否启用输出审查
  enableShield: boolean;
  // 是否启用权限网关
  enableGate: boolean;
  // 是否启用自动录制
  enableRecording: boolean;
  // 拦截到危险内容时的回调
  onBlock?: (type: 'input' | 'output' | 'tool', result: any) => void;
}

export interface WrappedLLMFunction {
  (input: string): Promise<string>;
  __mirrorai_wrapped?: boolean;
}

export interface WrappedToolFunction {
  (params: Record<string, unknown>): Promise<unknown>;
  __mirrorai_wrapped?: boolean;
  __mirrorai_tool_name?: string;
}

export class Interceptor {
  private recorder: Recorder;
  private guard: Guard;
  private shield: Shield;
  private gate: Gate;
  private config: InterceptorConfig;

  constructor(recorder: Recorder, config?: Partial<InterceptorConfig>, guards?: {
    guard?: Guard;
    shield?: Shield;
    gate?: Gate;
  }) {
    this.recorder = recorder;
    this.guard = guards?.guard || new Guard();
    this.shield = guards?.shield || new Shield();
    this.gate = guards?.gate || new Gate();
    this.config = {
      enableGuard: true,
      enableShield: true,
      enableGate: true,
      enableRecording: true,
      ...config,
    };
  }

  /**
   * 包装 LLM 调用函数，自动进行输入过滤 + 输出审查 + 录制
   */
  wrapLLM(fn: (input: string) => Promise<string>): WrappedLLMFunction {
    const self = this;
    const wrapped: WrappedLLMFunction = async function (input: string): Promise<string> {
      // 1. 输入过滤
      let processedInput = input;
      if (self.config.enableGuard) {
        const guardResult = self.guard.check(input);
        if (guardResult.decision === 'block') {
          self.config.onBlock?.('input', guardResult);
          throw new Error(`输入被拦截: ${guardResult.reasons.join(', ')}`);
        }
        if (guardResult.decision === 'flag') {
          self.config.onBlock?.('input', guardResult);
          // 不拦截，但记录警告
        }
        processedInput = guardResult.sanitizedInput;
      }

      // 2. 调用原始 LLM
      const output = await fn(processedInput);

      // 3. 输出审查
      let processedOutput = output;
      if (self.config.enableShield) {
        const shieldResult = self.shield.review(output);
        if (shieldResult.decision === 'block') {
          self.config.onBlock?.('output', shieldResult);
          throw new Error(`输出被拦截: ${shieldResult.detections.map(d => d.description).join(', ')}`);
        }
        if (shieldResult.decision === 'redact') {
          processedOutput = shieldResult.sanitizedOutput;
        }
      }

      // 4. 自动录制
      if (self.config.enableRecording) {
        await self.recorder.record({
          type: 'decision',
          input: { message: input },
          output: { response: processedOutput },
        });
      }

      return processedOutput;
    };

    wrapped.__mirrorai_wrapped = true;
    return wrapped;
  }

  /**
   * 包装工具调用函数，自动进行权限检查 + 录制
   */
  wrapTool(toolName: string, fn: (params: Record<string, unknown>) => Promise<unknown>): WrappedToolFunction {
    const self = this;
    const wrapped: WrappedToolFunction = async function (params: Record<string, unknown>): Promise<unknown> {
      // 1. 权限检查
      if (self.config.enableGate) {
        const call: ToolCall = {
          tool: toolName,
          params,
          agentId: self.recorder.getAgentId(),
          timestamp: new Date().toISOString(),
        };
        const gateResult = self.gate.check(call);
        if (gateResult.decision === 'deny') {
          self.config.onBlock?.('tool', gateResult);
          throw new Error(`工具调用被拒绝: ${gateResult.reasons.join(', ')}`);
        }
        if (gateResult.decision === 'require_approval') {
          self.config.onBlock?.('tool', gateResult);
          throw new Error(`工具调用需要人工审批: ${gateResult.reasons.join(', ')}`);
        }
      }

      // 2. 调用原始工具
      const result = await fn(params);

      // 3. 录制
      if (self.config.enableRecording) {
        await self.recorder.record({
          type: 'tool_call',
          input: { tool: toolName, params },
          output: { result },
        });
      }

      return result;
    };

    wrapped.__mirrorai_wrapped = true;
    wrapped.__mirrorai_tool_name = toolName;
    return wrapped;
  }
}
