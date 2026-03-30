/** 异常检测引擎 */
import { AnomalyRecord, LLMRecord, ToolRecord } from './types';

export class AnomalyDetector {
  private agentId: string;
  private sessionId: string;
  private recentLatencies: number[] = [];
  private recentErrors: number = 0;
  private recentCalls: number = 0;
  private toolCallCounts: Map<string, number> = new Map();
  private onAnomaly?: (a: AnomalyRecord) => void;
  private windowStart: number = Date.now();

  constructor(agentId: string, sessionId: string, onAnomaly?: (a: AnomalyRecord) => void) {
    this.agentId = agentId;
    this.sessionId = sessionId;
    this.onAnomaly = onAnomaly;
  }

  /** 分析一条 LLM 记录 */
  analyzeLLM(record: LLMRecord): void {
    this.recentCalls++;

    // 高延迟检测 (>15s)
    if (record.latency_ms > 15000) {
      this.emit({
        anomaly_type: 'high_latency',
        severity: record.latency_ms > 30000 ? 'high' : 'medium',
        detail: `LLM 调用延迟 ${record.latency_ms}ms (model: ${record.model})`,
      });
    }

    this.recentLatencies.push(record.latency_ms);
    if (this.recentLatencies.length > 100) this.recentLatencies.shift();

    // 错误率检测
    if (record.output.finish_reason === 'error') {
      this.recentErrors++;
    }

    // 检查输出中是否包含未脱敏的敏感信息（兜底检测）
    const output = record.output.content;
    if (output && /(?:sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|\d{3}-\d{2}-\d{4})/.test(output)) {
      this.emit({
        anomaly_type: 'pii_leak',
        severity: 'critical',
        detail: 'LLM 输出中包含疑似未脱敏的密钥或个人信息',
      });
    }
  }

  /** 分析一条工具调用记录 */
  analyzeTool(record: ToolRecord): void {
    this.recentCalls++;

    // 未授权工具检测（需配合权限白名单）
    // 这里做基础检测：调用频率异常
    const count = this.toolCallCounts.get(record.tool_name) || 0;
    this.toolCallCounts.set(record.tool_name, count + 1);

    if (count > 50) {
      this.emit({
        anomaly_type: 'infinite_loop',
        severity: 'high',
        detail: `工具 ${record.tool_name} 在本次会话中被调用 ${count + 1} 次，疑似循环`,
      });
    }

    // 工具执行超时
    if (record.duration_ms > 30000) {
      this.emit({
        anomaly_type: 'high_latency',
        severity: 'medium',
        detail: `工具 ${record.tool_name} 执行耗时 ${record.duration_ms}ms`,
      });
    }

    // 工具错误
    if (record.error) {
      this.recentErrors++;
    }
  }

  /** 定期窗口检查 */
  checkWindow(): void {
    const elapsed = Date.now() - this.windowStart;
    if (elapsed < 60000) return; // 每分钟检查一次

    // 错误率 > 30%
    if (this.recentCalls > 5 && this.recentErrors / this.recentCalls > 0.3) {
      this.emit({
        anomaly_type: 'error_spike',
        severity: 'high',
        detail: `最近窗口错误率 ${(this.recentErrors / this.recentCalls * 100).toFixed(1)}% (${this.recentErrors}/${this.recentCalls})`,
      });
    }

    // 重置窗口
    this.windowStart = Date.now();
    this.recentErrors = 0;
    this.recentCalls = 0;
  }

  private emit(partial: { anomaly_type: AnomalyRecord['anomaly_type']; severity: AnomalyRecord['severity']; detail: string }): void {
    const anomaly: AnomalyRecord = {
      id: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'anomaly',
      timestamp: new Date().toISOString(),
      agent_id: this.agentId,
      session_id: this.sessionId,
      ...partial,
    };
    this.onAnomaly?.(anomaly);
  }
}
