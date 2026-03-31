/**
 * 异常解释器
 * 将技术指标转化为人类可读的告警描述
 */

import { MonitorResult } from './entropy-monitor';

export interface ExplainedAlert {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  technicalDetails: string;
  recommendation: string;
}

export class AlertExplainer {
  /**
   * 解释熵监控结果
   */
  explainEntropy(result: MonitorResult): ExplainedAlert | null {
    if (result.riskLevel === 'safe') return null;

    const explanations: Record<string, () => ExplainedAlert> = {
      ACCEL_DRIFT: () => ({
        severity: 'warning',
        title: '意图正在偏离',
        description: `Agent 的推理方向正在加速偏离原始目标。当前偏离加速度为 ${result.acceleration.toFixed(3)}，已连续3步超过阈值。`,
        technicalDetails: `熵加速度 a(t) = ${result.acceleration.toFixed(4)}，超过阈值 θ_a`,
        recommendation: '建议暂停 Agent 并检查最近的输入内容，可能存在间接提示注入攻击。',
      }),
      JERK_REVERSAL: () => ({
        severity: 'critical',
        title: '行为模式突变',
        description: `Agent 的推理模式发生了突然的相变，就像物体突然改变运动方向。这通常意味着 Agent 正在执行一个与其原始任务完全不同的操作。`,
        technicalDetails: `熵 Jerk j(t) = ${result.jerk.toFixed(4)}，符号反转且幅度超过阈值`,
        recommendation: '立即拦截 Agent 操作。这可能是"思维注入"攻击的特征。',
      }),
      ENTROPY_SPIKE: () => ({
        severity: 'critical',
        title: '不确定性爆发',
        description: `Agent 对当前决策的确定性突然大幅下降，可能是遇到了意外输入或正在尝试执行未经授权的操作。`,
        technicalDetails: `熵突增 ΔH = ${result.entropy.toFixed(2)} bits，超过阈值`,
        recommendation: '检查 Agent 最近接收的输入，可能是对抗性攻击导致 Agent 困惑。',
      }),
      SUSTAINED_GROWTH: () => ({
        severity: 'warning',
        title: '连贯性持续下降',
        description: `Agent 的推理连贯性正在持续下降，输出变得越来越不确定和发散。`,
        technicalDetails: `熵速度 v(t) 已连续5步为正`,
        recommendation: '可能是上下文窗口过长导致的性能下降，建议重置对话或缩短上下文。',
      }),
    };

    for (const rule of result.triggeredRules) {
      const explainer = explanations[rule];
      if (explainer) return explainer();
    }

    return {
      severity: result.riskLevel === 'alert' ? 'critical' : 'warning',
      title: '未知异常',
      description: `检测到异常但无法提供详细解释。触发规则: ${result.triggeredRules.join(', ')}`,
      technicalDetails: `风险等级: ${result.riskLevel}`,
      recommendation: '请人工审查 Agent 的最近行为。',
    };
  }
}
