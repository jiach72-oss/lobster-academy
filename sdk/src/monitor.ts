/**
 * 龙虾学院 Blackbox SDK — 持续监控 + 预警系统
 * 实时分析 Agent 行为，检测异常并触发告警
 */

import { randomUUID } from 'crypto';
import { DecisionRecord, AgentPassport, Certificate, AgentChange, EvalRecord } from './types';
import { Signer } from './signer';

// ─────────────────────────────────────────────
// 预警系统
// ─────────────────────────────────────────────

/** 预警级别 */
export type AlertLevel = 'info' | 'warning' | 'critical';

/** 预警类型 */
export type AlertType =
  | 'performance_degradation'
  | 'security_breach'
  | 'anomaly_detected'
  | 'certificate_expiring'
  | 'permission_drift'
  | 'error_spike';

/** 预警事件 */
export interface Alert {
  /** 预警唯一 ID */
  id: string;
  /** 预警级别 */
  level: AlertLevel;
  /** 预警类型 */
  type: AlertType;
  /** 预警描述 */
  message: string;
  /** Agent 标识 */
  agentId: string;
  /** 触发时间（ISO8601） */
  timestamp: string;
  /** 附加元数据 */
  metadata?: Record<string, unknown>;
}

/** 监控配置 */
export interface MonitorConfig {
  /** Agent 标识 */
  agentId: string;
  /** 性能退化阈值（百分比），如 50 表示延迟增加 50% 则告警 */
  performanceThreshold: number;
  /** 错误率阈值（百分比），如 10 表示错误率超 10% 则告警 */
  errorRateThreshold: number;
  /** 异常检测窗口（事件数），用于滑动窗口分析 */
  anomalyWindow: number;
  /** 证书过期预警天数 */
  certExpiryWarningDays: number;
  /** 预警回调 */
  onAlert?: (alert: Alert) => void;
}

/**
 * Agent 持续监控器
 *
 * 分析决策记录，检测性能退化、安全违规、异常模式等。
 *
 * @example
 * ```typescript
 * import { AgentMonitor } from '@lobster-academy/blackbox';
 *
 * const monitor = new AgentMonitor({
 *   agentId: 'my-agent',
 *   performanceThreshold: 50,
 *   errorRateThreshold: 10,
 *   anomalyWindow: 100,
 *   certExpiryWarningDays: 30,
 *   onAlert: (alert) => console.warn('Alert:', alert),
 * });
 *
 * const alerts = monitor.analyze(records);
 * ```
 */
export class AgentMonitor {
  private config: MonitorConfig;
  private alerts: Alert[] = [];
  /** 历史平均延迟（用于性能退化检测） */
  private baselineLatency: number | null = null;
  /** 异常检测：基线错误率 */
  private baselineErrorRate: number | null = null;

  constructor(config: MonitorConfig) {
    if (!config.agentId || typeof config.agentId !== 'string') {
      throw new TypeError('agentId is required');
    }
    this.config = config;
  }

  /**
   * 分析一批事件，检测异常
   *
   * @param records 决策记录列表
   * @returns 检测到的预警列表
   */
  analyze(records: DecisionRecord[]): Alert[] {
    if (!records || records.length === 0) return [];

    const newAlerts: Alert[] = [];

    // 性能退化检测
    const perfAlert = this.checkPerformanceDegradation(records);
    if (perfAlert) newAlerts.push(perfAlert);

    // 安全违规检测
    const secAlert = this.checkSecurityBreach(records);
    if (secAlert) newAlerts.push(secAlert);

    // 异常模式检测
    const anomalyAlert = this.checkAnomaly(records);
    if (anomalyAlert) newAlerts.push(anomalyAlert);

    // 错误尖峰检测
    const errorAlert = this.checkErrorSpike(records);
    if (errorAlert) newAlerts.push(errorAlert);

    // 触发回调
    for (const alert of newAlerts) {
      this.alerts.push(alert);
      if (this.config.onAlert) {
        try {
          this.config.onAlert(alert);
        } catch (e) {
          console.error('[Blackbox] Alert callback error:', e);
        }
      }
    }

    return newAlerts;
  }

  /**
   * 检测性能退化
   *
   * 计算最近窗口内的平均延迟，与基线比较。
   */
  private checkPerformanceDegradation(records: DecisionRecord[]): Alert | null {
    const windowRecords = records.slice(-this.config.anomalyWindow);
    const latencies = windowRecords
      .map(r => r.duration)
      .filter((d): d is number => typeof d === 'number' && d > 0);

    if (latencies.length < 2) return null;

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    // 首次分析时设置基线
    if (this.baselineLatency === null) {
      this.baselineLatency = avgLatency;
      return null;
    }

    const degradation = ((avgLatency - this.baselineLatency) / this.baselineLatency) * 100;

    if (degradation > this.config.performanceThreshold) {
      return this.createAlert(
        'warning',
        'performance_degradation',
        `性能退化 ${degradation.toFixed(1)}%（基线 ${this.baselineLatency.toFixed(0)}ms → 当前 ${avgLatency.toFixed(0)}ms）`,
        { baseline: this.baselineLatency, current: avgLatency, degradation: degradation.toFixed(1) },
      );
    }

    // 滚动更新基线（指数移动平均）
    this.baselineLatency = this.baselineLatency * 0.9 + avgLatency * 0.1;
    return null;
  }

  /**
   * 检测安全违规
   *
   * 检查记录中是否包含敏感信息泄露迹象。
   */
  private checkSecurityBreach(records: DecisionRecord[]): Alert | null {
    const windowRecords = records.slice(-this.config.anomalyWindow);

    for (const record of windowRecords) {
      // 检查是否有 PII 泄露标记
      if (record.metadata?.piiDetected === 'true') {
        return this.createAlert(
          'critical',
          'security_breach',
          `检测到敏感信息泄露（记录 ${record.id}）`,
          { recordId: record.id, timestamp: record.timestamp },
        );
      }

      // 检查是否有异常工具调用（如 shell 注入）
      if (record.toolCalls) {
        for (const tc of record.toolCalls) {
          if (tc.error && /permission|denied|unauthorized|forbidden/i.test(tc.error)) {
            return this.createAlert(
              'critical',
              'security_breach',
              `检测到权限异常：工具 ${tc.tool} 调用被拒绝`,
              { tool: tc.tool, error: tc.error, recordId: record.id },
            );
          }
        }
      }
    }

    return null;
  }

  /**
   * 检测异常模式
   *
   * 使用统计方法检测行为异常：
   * - 调用频率突变
   * - 新工具首次出现
   * - 响应时间分布异常
   */
  private checkAnomaly(records: DecisionRecord[]): Alert | null {
    const windowRecords = records.slice(-this.config.anomalyWindow);
    if (windowRecords.length < 5) return null;

    // 检测调用频率突变
    const timestamps = windowRecords.map(r => new Date(r.timestamp).getTime());
    if (timestamps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

      // 最近间隔异常短（可能是循环调用或攻击）
      if (intervals.length > 0) {
        const lastInterval = intervals[intervals.length - 1];
        if (avgInterval > 0 && lastInterval < avgInterval * 0.1 && lastInterval < 100) {
          return this.createAlert(
            'warning',
            'anomaly_detected',
            `检测到调用频率异常：最近间隔 ${lastInterval}ms，平均 ${avgInterval.toFixed(0)}ms`,
            { lastInterval, avgInterval: avgInterval.toFixed(0) },
          );
        }
      }
    }

    // 检测新工具首次出现
    const allTools = new Set<string>();
    const recentTools = new Set<string>();
    for (const r of records.slice(0, -windowRecords.length)) {
      r.toolCalls?.forEach(tc => allTools.add(tc.tool));
    }
    for (const r of windowRecords) {
      r.toolCalls?.forEach(tc => recentTools.add(tc.tool));
    }
    for (const tool of recentTools) {
      if (!allTools.has(tool) && records.length > this.config.anomalyWindow) {
        return this.createAlert(
          'info',
          'anomaly_detected',
          `新工具首次出现: ${tool}`,
          { tool },
        );
      }
    }

    return null;
  }

  /**
   * 检测错误尖峰
   *
   * 计算最近窗口内的错误率，超过阈值则告警。
   */
  private checkErrorSpike(records: DecisionRecord[]): Alert | null {
    const windowRecords = records.slice(-this.config.anomalyWindow);
    if (windowRecords.length < 3) return null;

    const errorCount = windowRecords.filter(r => r.type === 'error').length;
    const errorRate = (errorCount / windowRecords.length) * 100;

    if (errorRate > this.config.errorRateThreshold) {
      return this.createAlert(
        'critical',
        'error_spike',
        `错误率 ${errorRate.toFixed(1)}% 超过阈值 ${this.config.errorRateThreshold}%（${errorCount}/${windowRecords.length}）`,
        { errorRate: errorRate.toFixed(1), errorCount, total: windowRecords.length },
      );
    }

    return null;
  }

  /**
   * 检测证书过期
   *
   * @param cert 证书对象
   * @returns 预警（如果即将过期）
   */
  checkCertificateExpiry(cert: Certificate): Alert | null {
    if (!cert.issuedAt) return null;

    const issuedDate = new Date(cert.issuedAt);
    // 假设证书有效期 1 年
    const expiryDate = new Date(issuedDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const now = new Date();
    const daysUntilExpiry = Math.floor(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilExpiry <= 0) {
      return this.createAlert(
        'critical',
        'certificate_expiring',
        `证书 ${cert.certId} 已过期`,
        { certId: cert.certId, expired: true },
      );
    }

    if (daysUntilExpiry <= this.config.certExpiryWarningDays) {
      return this.createAlert(
        'warning',
        'certificate_expiring',
        `证书 ${cert.certId} 将在 ${daysUntilExpiry} 天后过期`,
        { certId: cert.certId, daysUntilExpiry },
      );
    }

    return null;
  }

  /**
   * 检测权限漂移
   *
   * 比较护照中的权限与当前配置，检测是否发生偏差。
   *
   * @param passport Agent 护照
   * @param currentConfig 当前 Agent 配置
   * @returns 预警（如果检测到漂移）
   */
  checkPermissionDrift(
    passport: AgentPassport,
    currentConfig: { tools?: string[]; permissions?: Record<string, unknown> },
  ): Alert | null {
    const drifts: string[] = [];

    // 检测工具清单变化
    if (currentConfig.tools && passport.tools) {
      const passportToolNames = new Set(passport.tools.map(t => t.name));
      const currentToolNames = new Set(currentConfig.tools);

      for (const tool of currentToolNames) {
        if (!passportToolNames.has(tool)) {
          drifts.push(`新增工具: ${tool}`);
        }
      }
      for (const tool of passportToolNames) {
        if (!currentToolNames.has(tool)) {
          drifts.push(`移除工具: ${tool}`);
        }
      }
    }

    if (drifts.length > 0) {
      return this.createAlert(
        'warning',
        'permission_drift',
        `检测到权限漂移：${drifts.join('；')}`,
        { passportId: passport.passportId, drifts },
      );
    }

    return null;
  }

  /**
   * 获取历史预警
   *
   * @param filter 过滤条件
   * @returns 过滤后的预警列表
   */
  getAlerts(filter?: {
    level?: AlertLevel;
    type?: AlertType;
    since?: string;
  }): Alert[] {
    let result = [...this.alerts];

    if (filter?.level) {
      result = result.filter(a => a.level === filter.level);
    }
    if (filter?.type) {
      result = result.filter(a => a.type === filter.type);
    }
    if (filter?.since) {
      result = result.filter(a => a.timestamp >= filter.since!);
    }

    return result;
  }

  /** 创建预警对象 */
  private createAlert(
    level: AlertLevel,
    type: AlertType,
    message: string,
    metadata?: Record<string, unknown>,
  ): Alert {
    return {
      id: randomUUID(),
      level,
      type,
      message,
      agentId: this.config.agentId,
      timestamp: new Date().toISOString(),
      metadata,
    };
  }

  /** 重置监控器状态 */
  reset(): void {
    this.alerts = [];
    this.baselineLatency = null;
    this.baselineErrorRate = null;
  }
}

// ─────────────────────────────────────────────
// 自动复测触发器
// ─────────────────────────────────────────────

/** 复测建议 */
export interface RetestRecommendation {
  /** 是否需要复测 */
  needed: boolean;
  /** 复测范围 */
  scope: 'full' | 'partial' | 'security_only';
  /** 复测原因 */
  reason: string;
  /** 触发原因 */
  triggeredBy: string;
  /** 优先级 */
  priority: 'high' | 'medium' | 'low';
}

/**
 * 自动复测触发器
 *
 * 根据预警和配置变更决定是否需要重新评测。
 *
 * @example
 * ```typescript
 * import { RetestTrigger } from '@lobster-academy/blackbox';
 *
 * const trigger = new RetestTrigger();
 * const recommendation = trigger.evaluate(alerts, changes, lastEval);
 *
 * if (recommendation.needed) {
 *   console.log(`需要${recommendation.scope}复测: ${recommendation.reason}`);
 * }
 * ```
 */
export class RetestTrigger {
  /**
   * 根据预警和变更决定是否需要复测
   *
   * 评估逻辑：
   * - critical 预警 → 全量复测（high）
   * - 安全相关预警 → 仅安全复测（high）
   * - 模型/框架升级 → 全量复测（medium）
   * - 工具变更 → 部分复测（medium）
   * - 性能退化 → 部分复测（low）
   *
   * @param alerts 当前预警列表
   * @param changes Agent 配置变更记录
   * @param lastEval 最近一次评测记录
   * @returns 复测建议
   */
  evaluate(
    alerts: Alert[],
    changes: AgentChange[],
    lastEval: EvalRecord,
  ): RetestRecommendation {
    // 1. 检查 critical 预警
    const criticalAlerts = alerts.filter(a => a.level === 'critical');
    if (criticalAlerts.length > 0) {
      const types = criticalAlerts.map(a => a.type);
      const hasSecurityAlert = types.some(t =>
        t === 'security_breach' || t === 'permission_drift',
      );

      if (hasSecurityAlert) {
        return {
          needed: true,
          scope: 'security_only',
          reason: `检测到 ${criticalAlerts.length} 个严重安全预警`,
          triggeredBy: criticalAlerts.map(a => a.type).join(', '),
          priority: 'high',
        };
      }

      return {
        needed: true,
        scope: 'full',
        reason: `检测到 ${criticalAlerts.length} 个严重预警`,
        triggeredBy: criticalAlerts.map(a => a.type).join(', '),
        priority: 'high',
      };
    }

    // 2. 检查重大配置变更
    const modelUpgrade = changes.find(c => c.changeType === 'model_upgrade');
    const frameworkUpgrade = changes.find(c => c.changeType === 'framework_upgrade');
    if (modelUpgrade || frameworkUpgrade) {
      return {
        needed: true,
        scope: 'full',
        reason: modelUpgrade
          ? `模型升级: ${modelUpgrade.description}`
          : `框架升级: ${frameworkUpgrade!.description}`,
        triggeredBy: modelUpgrade ? 'model_upgrade' : 'framework_upgrade',
        priority: 'medium',
      };
    }

    // 3. 检查工具变更
    const toolChanges = changes.filter(c =>
      c.changeType === 'tool_added' || c.changeType === 'tool_removed',
    );
    if (toolChanges.length > 0) {
      return {
        needed: true,
        scope: 'partial',
        reason: `工具配置变更: ${toolChanges.map(c => c.description).join('; ')}`,
        triggeredBy: toolChanges.map(c => c.changeType).join(', '),
        priority: 'medium',
      };
    }

    // 4. 检查 warning 级别预警
    const warningAlerts = alerts.filter(a => a.level === 'warning');
    if (warningAlerts.length >= 3) {
      return {
        needed: true,
        scope: 'partial',
        reason: `累计 ${warningAlerts.length} 个警告预警`,
        triggeredBy: warningAlerts.map(a => a.type).join(', '),
        priority: 'low',
      };
    }

    // 5. 性能退化告警
    const perfAlerts = alerts.filter(a => a.type === 'performance_degradation');
    if (perfAlerts.length > 0) {
      return {
        needed: true,
        scope: 'partial',
        reason: '检测到性能退化',
        triggeredBy: 'performance_degradation',
        priority: 'low',
      };
    }

    // 无需复测
    return {
      needed: false,
      scope: 'partial',
      reason: '无重大变更或预警',
      triggeredBy: 'none',
      priority: 'low',
    };
  }
}
