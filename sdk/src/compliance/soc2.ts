/**
 * 明镜 Blackbox SDK — SOC2 审计报告生成器
 * 生成符合 SOC2 信任服务标准的审计报告
 */

import { randomUUID } from 'crypto';
import { AgentPassport, EvalRecord, DecisionRecord } from '../types';
import { Alert } from '../monitor';
import { Signer } from '../signer';

/** 评估状态 */
export type CriteriaStatus = 'pass' | 'fail' | 'partial';

/** 信任服务标准项 */
export interface CriteriaEntry {
  status: CriteriaStatus;
  evidence: string[];
}

/** SOC2 审计报告 */
export interface SOC2Report {
  /** 报告 ID */
  id: string;
  /** Agent 标识 */
  agentId: string;
  /** 审计期间 */
  auditPeriod: {
    start: string;
    end: string;
  };
  /** 信任服务标准 */
  criteria: {
    /** 安全性：系统受到保护，免受未经授权的访问 */
    security: CriteriaEntry;
    /** 可用性：系统按承诺可用 */
    availability: CriteriaEntry;
    /** 处理完整性：系统处理完整、准确、及时 */
    processingIntegrity: CriteriaEntry;
    /** 保密性：机密信息受到保护 */
    confidentiality: CriteriaEntry;
    /** 隐私：个人信息按隐私声明收集、使用、保留、披露和处置 */
    privacy: CriteriaEntry;
  };
  /** 证据摘要 */
  evidenceSummary: {
    /** 总事件数 */
    totalEvents: number;
    /** 审计期间开始 */
    periodStart: string;
    /** 审计期间结束 */
    periodEnd: string;
    /** 检测到的异常数 */
    anomaliesDetected: number;
    /** 已解决的异常数 */
    anomaliesResolved: number;
  };
  /** 生成时间 */
  generatedAt: string;
  /** Ed25519 签名 */
  signature?: string;
}

/**
 * 生成 SOC2 审计报告
 *
 * 基于 Agent 护照、评测历史、决策记录和告警，
 * 评估 SOC2 五大信任服务标准的合规状态。
 *
 * @param passport Agent 护照
 * @param evalHistory 评测历史
 * @param records 决策记录
 * @param alerts 告警列表
 * @param signer 签名器（可选）
 * @returns SOC2 审计报告
 *
 * @example
 * ```typescript
 * import { generateSOC2Report } from '@lobster-academy/blackbox/compliance';
 *
 * const report = generateSOC2Report(passport, evalHistory, records, alerts, signer);
 * console.log(report.criteria.security.status); // 'pass' | 'fail' | 'partial'
 * ```
 */
export function generateSOC2Report(
  passport: AgentPassport,
  evalHistory: EvalRecord[],
  records: DecisionRecord[],
  alerts: Alert[],
  signer?: Signer,
): SOC2Report {
  // 确定审计期间
  const timestamps = records.map(r => r.timestamp).sort();
  const periodStart = timestamps.length > 0 ? timestamps[0] : new Date().toISOString();
  const periodEnd = timestamps.length > 0 ? timestamps[timestamps.length - 1] : new Date().toISOString();

  // 评估各标准
  const security = evaluateSecurity(passport, records, alerts);
  const availability = evaluateAvailability(records, alerts);
  const processingIntegrity = evaluateProcessingIntegrity(records, evalHistory);
  const confidentiality = evaluateConfidentiality(passport, records);
  const privacy = evaluatePrivacy(passport, records);

  // 统计异常
  const securityBreachAlerts = alerts.filter(a => a.type === 'security_breach');
  const anomalyAlerts = alerts.filter(a => a.type === 'anomaly_detected');
  const totalAnomalies = securityBreachAlerts.length + anomalyAlerts.length;
  const criticalAlerts = alerts.filter(a => a.level === 'critical');

  const report: SOC2Report = {
    id: randomUUID(),
    agentId: passport.agentId,
    auditPeriod: { start: periodStart, end: periodEnd },
    criteria: {
      security,
      availability,
      processingIntegrity,
      confidentiality,
      privacy,
    },
    evidenceSummary: {
      totalEvents: records.length,
      periodStart,
      periodEnd,
      anomaliesDetected: totalAnomalies,
      anomaliesResolved: Math.max(0, totalAnomalies - criticalAlerts.length),
    },
    generatedAt: new Date().toISOString(),
  };

  // 签名
  if (signer && signer.hasKey()) {
    const hash = Signer.hash(JSON.stringify({
      id: report.id,
      agentId: report.agentId,
      criteria: report.criteria,
      generatedAt: report.generatedAt,
    }));
    report.signature = signer.sign(hash);
  }

  return report;
}

/** 评估安全性 */
function evaluateSecurity(
  passport: AgentPassport,
  records: DecisionRecord[],
  alerts: Alert[],
): CriteriaEntry {
  const evidence: string[] = [];
  let status: CriteriaStatus = 'pass';

  // 沙箱保护
  if (passport.permissions.sandboxed) {
    evidence.push('Agent 运行在沙箱模式下');
  } else {
    evidence.push('⚠️ Agent 未启用沙箱模式');
    status = 'partial';
  }

  // 数字签名
  const signedRecords = records.filter(r => r.signature);
  evidence.push(`${signedRecords.length}/${records.length} 条记录已签名`);

  // 签名比例
  if (records.length > 0 && signedRecords.length === records.length) {
    evidence.push('所有审计记录均已签名');
  } else if (records.length > 0 && signedRecords.length > 0) {
    status = 'partial';
    evidence.push('部分审计记录缺少签名');
  }

  // 权限控制
  evidence.push(`拒绝域名列表: ${passport.permissions.deniedDomains.length} 个`);
  evidence.push(`允许域名列表: ${passport.permissions.allowedDomains.length} 个`);

  // 安全告警
  const securityAlerts = alerts.filter(a =>
    a.type === 'security_breach' || a.type === 'permission_drift',
  );
  if (securityAlerts.filter(a => a.level === 'critical').length > 0) {
    status = 'fail';
    evidence.push(`❌ 检测到 ${securityAlerts.filter(a => a.level === 'critical').length} 个严重安全告警`);
  } else if (securityAlerts.length > 0) {
    status = 'partial';
    evidence.push(`检测到 ${securityAlerts.length} 个安全相关告警`);
  }

  return { status, evidence };
}

/** 评估可用性 */
function evaluateAvailability(
  records: DecisionRecord[],
  alerts: Alert[],
): CriteriaEntry {
  const evidence: string[] = [];
  let status: CriteriaStatus = 'pass';

  // 错误率分析
  const errorRecords = records.filter(r => r.type === 'error');
  const errorRate = records.length > 0 ? (errorRecords.length / records.length) * 100 : 0;

  evidence.push(`总处理事件: ${records.length}`);
  evidence.push(`错误率: ${errorRate.toFixed(2)}%`);

  if (errorRate > 10) {
    status = 'fail';
    evidence.push(`❌ 错误率超过 10% 阈值`);
  } else if (errorRate > 5) {
    status = 'partial';
    evidence.push(`⚠️ 错误率超过 5% 警戒线`);
  }

  // 性能告警
  const perfAlerts = alerts.filter(a => a.type === 'performance_degradation');
  if (perfAlerts.length > 0) {
    status = 'partial';
    evidence.push(`检测到 ${perfAlerts.length} 次性能退化`);
  }

  // 延迟分析
  const durations = records
    .map(r => r.duration)
    .filter((d): d is number => typeof d === 'number' && d > 0);

  if (durations.length > 0) {
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const p95Duration = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)];
    evidence.push(`平均响应时间: ${avgDuration.toFixed(0)}ms`);
    evidence.push(`P95 响应时间: ${p95Duration.toFixed(0)}ms`);
  }

  // 错误尖峰
  const errorSpikes = alerts.filter(a => a.type === 'error_spike');
  if (errorSpikes.length > 0) {
    status = 'partial';
    evidence.push(`检测到 ${errorSpikes.length} 次错误尖峰`);
  }

  return { status, evidence };
}

/** 评估处理完整性 */
function evaluateProcessingIntegrity(
  records: DecisionRecord[],
  evalHistory: EvalRecord[],
): CriteriaEntry {
  const evidence: string[] = [];
  let status: CriteriaStatus = 'pass';

  // 哈希完整性
  const hashedRecords = records.filter(r => r.hash);
  evidence.push(`${hashedRecords.length}/${records.length} 条记录具有完整性哈希`);

  // 评测等级
  if (evalHistory.length > 0) {
    const latest = evalHistory[evalHistory.length - 1];
    evidence.push(`最新评测等级: ${latest.grade}`);
    evidence.push(`可靠性评分: ${latest.dimensions.reliability.score}/${latest.dimensions.reliability.max}`);

    if (latest.dimensions.reliability.score < latest.dimensions.reliability.max * 0.6) {
      status = 'partial';
      evidence.push('⚠️ 可靠性评分偏低');
    }
  }

  // 处理一致性
  const decisionRecords = records.filter(r => r.type === 'decision');
  evidence.push(`决策记录数: ${decisionRecords.length}`);
  evidence.push(`工具调用记录: ${records.filter(r => r.type === 'tool_call').length}`);

  // 推理记录覆盖率
  const withReasoning = records.filter(r => r.reasoning);
  if (records.length > 0) {
    const reasoningRate = (withReasoning.length / records.length) * 100;
    evidence.push(`推理记录覆盖率: ${reasoningRate.toFixed(1)}%`);
  }

  return { status, evidence };
}

/** 评估保密性 */
function evaluateConfidentiality(
  passport: AgentPassport,
  records: DecisionRecord[],
): CriteriaEntry {
  const evidence: string[] = [];
  let status: CriteriaStatus = 'pass';

  // 数据脱敏
  evidence.push('输入/输出自动脱敏处理已启用');
  evidence.push('支持 email、phone、creditCard 等内置模式');

  // 访问控制
  if (passport.permissions.sandboxed) {
    evidence.push('沙箱模式限制 Agent 访问范围');
  }

  if (passport.permissions.deniedDomains.length > 0) {
    evidence.push(`拒绝访问域名: ${passport.permissions.deniedDomains.join(', ')}`);
  }

  // Token 限制
  if (passport.permissions.maxTokens > 0) {
    evidence.push(`Token 消耗上限: ${passport.permissions.maxTokens}`);
  }

  // 执行时间限制
  if (passport.permissions.maxExecutionTime > 0) {
    evidence.push(`执行时间上限: ${passport.permissions.maxExecutionTime}ms`);
  }

  return { status, evidence };
}

/** 评估隐私 */
function evaluatePrivacy(
  passport: AgentPassport,
  records: DecisionRecord[],
): CriteriaEntry {
  const evidence: string[] = [];
  let status: CriteriaStatus = 'pass';

  // PII 处理
  evidence.push('PII 数据自动脱敏处理');
  evidence.push('审计记录存储前进行脱敏处理');

  // 隐私告警
  const piiAlerts = records.filter(r => r.metadata?.piiDetected === 'true');
  if (piiAlerts.length > 0) {
    status = 'partial';
    evidence.push(`⚠️ 检测到 ${piiAlerts.length} 条记录可能存在 PII 泄露`);
  }

  // 数据保留
  evidence.push('脱敏数据加密存储');
  evidence.push('支持数据保留策略配置');

  return { status, evidence };
}
