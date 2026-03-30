/**
 * 明镜 Blackbox SDK — EU AI Act 合规报告生成器
 * 根据 EU AI Act 要求生成技术文档和风险管理报告
 */

import { randomUUID } from 'crypto';
import { AgentPassport, EvalRecord, Certificate } from '../types';
import { Alert } from '../monitor';
import { Signer } from '../signer';

/** 风险等级 */
export type RiskCategory = 'minimal' | 'limited' | 'high' | 'unacceptable';

/** EU AI Act 合规报告 */
export interface EUAIActReport {
  /** 报告 ID */
  id: string;
  /** 系统描述 */
  systemDescription: {
    /** 系统名称 */
    name: string;
    /** 系统用途 */
    purpose: string;
    /** 风险分类 */
    riskCategory: RiskCategory;
    /** 框架信息 */
    framework: { name: string; version: string };
    /** 模型信息 */
    model: { provider: string; name: string; version?: string };
  };
  /** 风险管理 */
  riskManagement: {
    /** 已识别风险 */
    identifiedRisks: string[];
    /** 缓解措施 */
    mitigationMeasures: string[];
    /** 残余风险 */
    residualRisks: string[];
  };
  /** 数据治理 */
  dataGovernance: {
    /** 数据来源 */
    dataSources: string[];
    /** 处理步骤 */
    processingSteps: string[];
    /** 保留策略 */
    retentionPolicy: string;
  };
  /** 技术文档 */
  technicalDocumentation: {
    /** 架构描述 */
    architecture: string;
    /** 测试结果摘要 */
    testingResults: string;
    /** 监控配置 */
    monitoringSetup: string;
  };
  /** 评测摘要 */
  evaluationSummary?: {
    /** 最新等级 */
    latestGrade: string;
    /** 各维度分数 */
    dimensions: EvalRecord['dimensions'];
    /** 评测次数 */
    evalCount: number;
  };
  /** 告警摘要 */
  alertSummary?: {
    /** 总告警数 */
    total: number;
    /** 按级别统计 */
    byLevel: Record<string, number>;
    /** 严重告警详情 */
    criticalAlerts: string[];
  };
  /** 生成时间 */
  generatedAt: string;
  /** Ed25519 签名 */
  signature?: string;
}

/**
 * 生成 EU AI Act 合规报告
 *
 * 基于 Agent 护照、评测历史和告警记录，生成符合 EU AI Act 要求的技术文档。
 *
 * @param passport Agent 护照
 * @param evalHistory 评测历史
 * @param alerts 告警列表
 * @param signer 签名器（可选）
 * @returns EU AI Act 合规报告
 *
 * @example
 * ```typescript
 * import { generateEUAIActReport } from '@lobster-academy/blackbox/compliance';
 *
 * const report = generateEUAIActReport(passport, evalHistory, alerts, signer);
 * console.log(report.riskManagement.identifiedRisks);
 * ```
 */
export function generateEUAIActReport(
  passport: AgentPassport,
  evalHistory: EvalRecord[],
  alerts: Alert[],
  signer?: Signer,
): EUAIActReport {
  const latestEval = evalHistory.length > 0 ? evalHistory[evalHistory.length - 1] : null;

  // 根据 Agent 能力自动分类风险等级
  const riskCategory = classifyRisk(passport);

  // 基于评测数据识别风险
  const identifiedRisks = identifyRisks(passport, evalHistory, alerts);
  const mitigationMeasures = generateMitigations(passport, identifiedRisks);
  const residualRisks = computeResidualRisks(identifiedRisks, mitigationMeasures);

  // 告警统计
  const alertSummary = computeAlertSummary(alerts);

  const report: EUAIActReport = {
    id: randomUUID(),
    systemDescription: {
      name: passport.agentId,
      purpose: `AI Agent (${passport.framework.name} 框架)`,
      riskCategory,
      framework: passport.framework,
      model: passport.model,
    },
    riskManagement: {
      identifiedRisks,
      mitigationMeasures,
      residualRisks,
    },
    dataGovernance: {
      dataSources: [
        '用户输入数据',
        '工具调用结果',
        'LLM 推理输出',
      ],
      processingSteps: [
        '1. 输入脱敏处理（PII/敏感信息过滤）',
        '2. LLM 推理与决策',
        '3. 工具调用执行',
        '4. 输出脱敏处理',
        '5. 审计记录签名存储',
      ],
      retentionPolicy: '审计记录保留不少于 3 年，脱敏后存储，签名保证完整性',
    },
    technicalDocumentation: {
      architecture: buildArchitectureDesc(passport),
      testingResults: buildTestingResults(evalHistory, alerts),
      monitoringSetup: buildMonitoringDesc(passport),
    },
    evaluationSummary: latestEval ? {
      latestGrade: latestEval.grade,
      dimensions: latestEval.dimensions,
      evalCount: evalHistory.length,
    } : undefined,
    alertSummary,
    generatedAt: new Date().toISOString(),
  };

  // 签名
  if (signer && signer.hasKey()) {
    const hash = Signer.hash(JSON.stringify({
      id: report.id,
      systemDescription: report.systemDescription,
      riskManagement: report.riskManagement,
      generatedAt: report.generatedAt,
    }));
    report.signature = signer.sign(hash);
  }

  return report;
}

/** 根据 Agent 能力分类风险等级 */
function classifyRisk(passport: AgentPassport): RiskCategory {
  const hasExecute = passport.tools.some(t =>
    t.permissions.includes('execute') || t.category === 'code-exec',
  );
  const hasFileWrite = passport.tools.some(t =>
    t.permissions.includes('write') && t.category === 'file-io',
  );
  const hasNetworkAccess = passport.permissions.allowedDomains.length > 0;
  const isSandboxed = passport.permissions.sandboxed;

  if (hasExecute && hasNetworkAccess && !isSandboxed) {
    return 'high';
  }
  if (hasFileWrite || (hasNetworkAccess && !isSandboxed)) {
    return 'limited';
  }
  return 'minimal';
}

/** 基于数据识别风险 */
function identifyRisks(
  passport: AgentPassport,
  evalHistory: EvalRecord[],
  alerts: Alert[],
): string[] {
  const risks: string[] = [];

  // 基于工具能力
  if (passport.tools.some(t => t.category === 'code-exec')) {
    risks.push('代码执行能力可能导致系统级安全风险');
  }
  if (passport.tools.some(t => t.category === 'file-io' && t.permissions.includes('write'))) {
    risks.push('文件写入能力可能导致数据泄露或篡改');
  }
  if (passport.permissions.allowedDomains.length > 0) {
    risks.push('网络访问能力可能导致数据外泄');
  }
  if (!passport.permissions.sandboxed) {
    risks.push('非沙箱模式下 Agent 具有更大操作自由度');
  }

  // 基于评测历史
  const latestEval = evalHistory.length > 0 ? evalHistory[evalHistory.length - 1] : null;
  if (latestEval) {
    if (latestEval.dimensions.security.score < latestEval.dimensions.security.max * 0.6) {
      risks.push('安全维度评分偏低，存在防护漏洞风险');
    }
    if (latestEval.dimensions.reliability.score < latestEval.dimensions.reliability.max * 0.6) {
      risks.push('可靠性维度评分偏低，存在服务中断风险');
    }
  }

  // 基于告警
  const criticalAlerts = alerts.filter(a => a.level === 'critical');
  if (criticalAlerts.length > 0) {
    risks.push(`历史出现 ${criticalAlerts.length} 次严重告警`);
  }

  if (risks.length === 0) {
    risks.push('当前未识别到重大风险');
  }

  return risks;
}

/** 生成缓解措施 */
function generateMitigations(
  passport: AgentPassport,
  risks: string[],
): string[] {
  const measures: string[] = [
    '所有输入输出经过 PII 脱敏处理',
    '审计记录使用 Ed25519 数字签名保证不可篡改',
    'Merkle Chain 保证事件链完整性',
  ];

  if (passport.permissions.sandboxed) {
    measures.push('Agent 运行在沙箱环境中');
  }
  if (passport.permissions.maxExecutionTime > 0) {
    measures.push(`执行时间上限: ${passport.permissions.maxExecutionTime}ms`);
  }
  if (passport.permissions.maxTokens > 0) {
    measures.push(`Token 消耗上限: ${passport.permissions.maxTokens}`);
  }
  if (passport.permissions.deniedDomains.length > 0) {
    measures.push(`拒绝访问域名: ${passport.permissions.deniedDomains.join(', ')}`);
  }
  if (passport.expiresAt) {
    measures.push(`护照有效期: ${passport.expiresAt}`);
  }

  measures.push('持续监控系统实时检测异常行为');
  measures.push('定期安全评测和合规审计');

  return measures;
}

/** 计算残余风险 */
function computeResidualRisks(
  risks: string[],
  mitigations: string[],
): string[] {
  const residual: string[] = [];

  if (mitigations.length < risks.length) {
    residual.push('部分已识别风险尚未完全覆盖缓解措施');
  }

  residual.push('LLM 生成内容的准确性无法 100% 保证（幻觉风险）');
  residual.push('第三方工具调用的外部依赖风险');

  return residual;
}

/** 计算告警摘要 */
function computeAlertSummary(alerts: Alert[]): EUAIActReport['alertSummary'] {
  const byLevel: Record<string, number> = { info: 0, warning: 0, critical: 0 };
  const criticalMessages: string[] = [];

  for (const alert of alerts) {
    byLevel[alert.level] = (byLevel[alert.level] || 0) + 1;
    if (alert.level === 'critical') {
      criticalMessages.push(`[${alert.timestamp}] ${alert.type}: ${alert.message}`);
    }
  }

  return {
    total: alerts.length,
    byLevel,
    criticalAlerts: criticalMessages,
  };
}

/** 构建架构描述 */
function buildArchitectureDesc(passport: AgentPassport): string {
  const lines = [
    `框架: ${passport.framework.name} v${passport.framework.version}`,
    `模型: ${passport.model.provider}/${passport.model.name}`,
    `工具数量: ${passport.tools.length}`,
    `工具列表: ${passport.tools.map(t => `${t.name}(${t.category})`).join(', ')}`,
    `沙箱模式: ${passport.permissions.sandboxed ? '是' : '否'}`,
  ];
  return lines.join('\n');
}

/** 构建测试结果摘要 */
function buildTestingResults(
  evalHistory: EvalRecord[],
  alerts: Alert[],
): string {
  if (evalHistory.length === 0) {
    return '暂无评测记录';
  }

  const latest = evalHistory[evalHistory.length - 1];
  const lines = [
    `评测次数: ${evalHistory.length}`,
    `最新等级: ${latest.grade}`,
    `总分: ${latest.totalScore}`,
    `安全: ${latest.dimensions.security.score}/${latest.dimensions.security.max}`,
    `可靠性: ${latest.dimensions.reliability.score}/${latest.dimensions.reliability.max}`,
    `可观测性: ${latest.dimensions.observability.score}/${latest.dimensions.observability.max}`,
    `合规性: ${latest.dimensions.compliance.score}/${latest.dimensions.compliance.max}`,
    `可解释性: ${latest.dimensions.explainability.score}/${latest.dimensions.explainability.max}`,
    `告警总数: ${alerts.length}`,
  ];
  return lines.join('\n');
}

/** 构建监控描述 */
function buildMonitoringDesc(passport: AgentPassport): string {
  return [
    '持续监控系统已启用',
    '监控维度: 性能退化、安全违规、异常模式、错误尖峰、证书过期、权限漂移',
    '预警级别: info / warning / critical',
    '实时告警回调机制已配置',
    `Agent ID: ${passport.agentId}`,
  ].join('\n');
}
