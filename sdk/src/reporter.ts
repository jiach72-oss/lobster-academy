/**
 * 龙虾学院 Blackbox SDK — 报告生成器
 * 生成可验证的审计报告
 */

import { randomUUID } from 'crypto';
import { DecisionRecord, AuditReport, ReportSummary, Anomaly } from './types';
import { Signer } from './signer';
import { Redactor } from './redactor';

/** 签名截断显示长度 */
const SIGNATURE_DISPLAY_LEN = 40;

export class Reporter {
  private agentId: string;
  private signer: Signer;
  private redactor: Redactor;

  constructor(agentId: string, signer: Signer) {
    if (!agentId || typeof agentId !== 'string') {
      throw new TypeError('agentId is required');
    }
    if (!signer) {
      throw new TypeError('signer is required');
    }
    this.agentId = agentId;
    this.signer = signer;
    this.redactor = new Redactor();
  }

  /** 生成审计报告 */
  generateReport(records: DecisionRecord[], options?: {
    from?: string;
    to?: string;
  }): AuditReport {
    if (!Array.isArray(records)) {
      throw new TypeError('records must be an array');
    }

    const filtered = this.filterByPeriod(records, options?.from, options?.to);
    const summary = this.computeSummary(filtered);
    const anomalies = this.detectAnomalies(filtered);

    const report: AuditReport = {
      id: randomUUID(),
      agentId: this.agentId,
      period: {
        from: options?.from ?? (filtered[0]?.timestamp ?? new Date().toISOString()),
        to: options?.to ?? new Date().toISOString(),
      },
      summary,
      records: filtered,
      anomalies,
      generatedAt: new Date().toISOString(),
    };

    // 签名报告（覆盖 records 哈希，防篡改）
    if (this.signer.hasKey()) {
      // 对每条记录的 hash 做汇总哈希，纳入签名
      const recordsHash = Signer.hash(
        report.records.map(r => r.hash ?? '').join('|')
      );
      const anomaliesHash = Signer.hash(
        JSON.stringify(report.anomalies.map(a => ({ type: a.type, message: a.message, timestamp: a.timestamp })))
      );
      const signInput = JSON.stringify({
        id: report.id,
        agentId: report.agentId,
        summary: report.summary,
        generatedAt: report.generatedAt,
        recordsHash,
        anomaliesHash,
      });
      report.signature = this.signer.sign(Signer.hash(signInput));
    }

    return report;
  }

  /** 生成JSON格式报告 */
  toJSON(report: AuditReport): string {
    if (!report || typeof report !== 'object') {
      throw new TypeError('report must be an object');
    }
    return JSON.stringify(report, null, 2);
  }

  /** 生成Markdown格式报告 */
  toMarkdown(report: AuditReport): string {
    if (!report || typeof report !== 'object') {
      throw new TypeError('report must be an object');
    }

    const lines = [
      `# 🦞 龙虾学院 Blackbox 审计报告`,
      '',
      '| 项目 | 详情 |',
      '|------|------|',
      `| Agent | ${this.redactor.redactString(report.agentId)} |`,
      `| 期间 | ${this.redactor.redactString(report.period.from)} → ${this.redactor.redactString(report.period.to)} |`,
      `| 生成时间 | ${report.generatedAt} |`,
      '',
      '## 📊 统计摘要',
      '',
      `| 指标 | 数值 |`,
      `|------|------|`,
      `| 总决策数 | ${report.summary.totalDecisions} |`,
      `| 工具调用 | ${report.summary.totalToolCalls} |`,
      `| 错误次数 | ${report.summary.totalErrors} |`,
      `| 平均耗时 | ${report.summary.avgDuration}ms |`,
      `| 使用工具 | ${report.summary.uniqueTools}种 |`,
      '',
    ];

    if (report.anomalies.length > 0) {
      lines.push('## ⚠️ 异常检测', '');
      lines.push('| 类型 | 严重度 | 描述 | 时间 |');
      lines.push('|------|--------|------|------|');
      for (const a of report.anomalies) {
        const sevIcon = a.severity === 'critical' ? '🔴' : a.severity === 'high' ? '🟠' : a.severity === 'medium' ? '🟡' : '🟢';
        lines.push(`| ${a.type} | ${sevIcon} ${a.severity} | ${this.redactor.redactString(a.message)} | ${a.timestamp} |`);
      }
      lines.push('');
    }

    if (report.signature) {
      lines.push('## 🔐 数字签名', '');
      lines.push('```');
      lines.push(report.signature);
      lines.push('```', '');
      lines.push('> 此签名基于 Ed25519，可使用公钥独立验证报告完整性。', '');
    }

    lines.push('---', '*由龙虾学院工部技术组生成*', '');
    return lines.join('\n');
  }

  /** 生成简易文本报告 */
  toText(report: AuditReport): string {
    if (!report || typeof report !== 'object') {
      throw new TypeError('report must be an object');
    }

    const lines = [
      '='.repeat(60),
      `🦞 龙虾学院 Blackbox 审计报告`,
      `   Agent: ${this.redactor.redactString(report.agentId)}`,
      `   期间: ${this.redactor.redactString(report.period.from)} → ${this.redactor.redactString(report.period.to)}`,
      '='.repeat(60),
      '',
      '📊 统计摘要',
      `   总决策数: ${report.summary.totalDecisions}`,
      `   工具调用: ${report.summary.totalToolCalls}`,
      `   错误次数: ${report.summary.totalErrors}`,
      `   平均耗时: ${report.summary.avgDuration}ms`,
      `   使用工具: ${report.summary.uniqueTools}种`,
      '',
    ];

    if (report.anomalies.length > 0) {
      lines.push('⚠️ 异常检测');
      for (const a of report.anomalies) {
        lines.push(`   [${a.severity.toUpperCase()}] ${this.redactor.redactString(a.message)}`);
      }
      lines.push('');
    }

    if (report.signature) {
      lines.push('🔐 数字签名');
      lines.push(`   ${report.signature.substring(0, SIGNATURE_DISPLAY_LEN)}...`);
      lines.push('');
    }

    lines.push('='.repeat(60));
    return lines.join('\n');
  }

  /** 生成HTML报告 */
  toHTML(report: AuditReport): string {
    if (!report || typeof report !== 'object') {
      throw new TypeError('report must be an object');
    }
    const esc = (s: string) => this.redactor.redactString(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const anomalyRows = report.anomalies.map(a =>
      `<tr><td>${esc(a.type)}</td><td>${esc(a.severity)}</td><td>${esc(a.message)}</td><td>${esc(a.timestamp)}</td></tr>`
    ).join('\n');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>🦞 龙虾学院 Blackbox 审计报告</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
  h1 { color: #c0392b; }
  .meta { color: #666; margin-bottom: 1.5rem; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
  .card { background: #f8f9fa; border-radius: 8px; padding: 1rem; text-align: center; }
  .card .num { font-size: 2rem; font-weight: bold; color: #2c3e50; }
  .card .label { color: #666; font-size: 0.9rem; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; font-size: 0.85rem; }
  th { background: #f0f0f0; }
  .severity-critical { color: #c0392b; font-weight: bold; }
  .severity-high { color: #e67e22; font-weight: bold; }
  .sig { font-family: monospace; font-size: 0.8rem; color: #888; word-break: break-all; }
</style>
</head>
<body>
<h1>🦞 龙虾学院 Blackbox 审计报告</h1>
<div class="meta">
  <strong>Agent:</strong> ${esc(report.agentId)}<br>
  <strong>期间:</strong> ${esc(report.period.from)} → ${esc(report.period.to)}<br>
  <strong>生成时间:</strong> ${esc(report.generatedAt)}
</div>

<h2>📊 统计摘要</h2>
<div class="summary">
  <div class="card"><div class="num">${report.summary.totalDecisions}</div><div class="label">总决策数</div></div>
  <div class="card"><div class="num">${report.summary.totalToolCalls}</div><div class="label">工具调用</div></div>
  <div class="card"><div class="num">${report.summary.totalErrors}</div><div class="label">错误次数</div></div>
  <div class="card"><div class="num">${report.summary.avgDuration}ms</div><div class="label">平均耗时</div></div>
  <div class="card"><div class="num">${report.summary.uniqueTools}</div><div class="label">工具种类</div></div>
</div>
${report.anomalies.length > 0 ? `
<h2>⚠️ 异常检测</h2>
<table>
  <tr><th>类型</th><th>严重度</th><th>描述</th><th>时间</th></tr>
  ${anomalyRows}
</table>` : ''}
${report.signature ? `
<h2>🔐 数字签名</h2>
<p class="sig">${esc(report.signature)}</p>
<p style="font-size:0.8rem;color:#888;">此签名基于 Ed25519，可使用公钥独立验证报告完整性。</p>` : ''}
</body>
</html>`;
  }

  /** 验证报告完整性 */
  static verifyReport(report: AuditReport, publicKeyBase64: string): boolean {
    try {
      if (!report || typeof report !== 'object' || !report.signature) return false;
      if (typeof publicKeyBase64 !== 'string' || publicKeyBase64.length === 0) return false;

      const signInput = JSON.stringify({
        id: report.id,
        agentId: report.agentId,
        summary: report.summary,
        generatedAt: report.generatedAt,
        recordsHash: Signer.hash(
          report.records.map(r => r.hash ?? '').join('|')
        ),
        anomaliesHash: Signer.hash(
          JSON.stringify(report.anomalies.map(a => ({ type: a.type, message: a.message, timestamp: a.timestamp })))
        ),
      });
      return Signer.verify(Signer.hash(signInput), report.signature, publicKeyBase64);
    } catch {
      return false;
    }
  }

  // --- 内部方法 ---

  private filterByPeriod(records: DecisionRecord[], from?: string, to?: string): DecisionRecord[] {
    return records.filter(r => {
      if (from && r.timestamp < from) return false;
      if (to && r.timestamp > to) return false;
      return true;
    });
  }

  private computeSummary(records: DecisionRecord[]): ReportSummary {
    const tools = new Set<string>();
    let totalToolCalls = 0;
    let totalErrors = 0;
    let totalDuration = 0;
    let durationCount = 0;

    for (const r of records) {
      if (r.type === 'error') totalErrors++;
      // duration !== undefined 且 >= 0（包括 0ms 的有效记录）
      if (r.duration !== undefined && r.duration >= 0) {
        totalDuration += r.duration;
        durationCount++;
      }
      if (r.toolCalls) {
        for (const tc of r.toolCalls) {
          tools.add(tc.tool);
          totalToolCalls++;
        }
      }
    }

    return {
      totalDecisions: records.length,
      totalToolCalls,
      totalErrors,
      avgDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
      uniqueTools: tools.size,
    };
  }

  private detectAnomalies(records: DecisionRecord[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // 检测高延迟
    for (const r of records) {
      if (r.duration !== undefined && r.duration > 10000) {
        anomalies.push({
          type: 'high_latency',
          severity: r.duration > 30000 ? 'critical' : 'high',
          message: `决策 ${r.id} 耗时 ${r.duration}ms，超过阈值`,
          recordId: r.id,
          timestamp: r.timestamp,
        });
      }
    }

    // 检测错误激增（至少有10条记录才触发）
    if (records.length >= 10) {
      const errorCount = records.filter(r => r.type === 'error').length;
      if (errorCount / records.length > 0.1) {
        anomalies.push({
          type: 'error_spike',
          severity: 'high',
          message: `错误率 ${(errorCount / records.length * 100).toFixed(1)}%，超过10%阈值`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 检测异常工具调用（单一工具占比过高 > 70%）
    if (records.length >= 5) {
      const toolCounts = new Map<string, number>();
      for (const r of records) {
        if (r.toolCalls) {
          for (const tc of r.toolCalls) {
            toolCounts.set(tc.tool, (toolCounts.get(tc.tool) ?? 0) + 1);
          }
        }
      }
      const totalCalls = [...toolCounts.values()].reduce((a, b) => a + b, 0);
      if (totalCalls > 0) {
        for (const [tool, count] of toolCounts) {
          const ratio = count / totalCalls;
          if (ratio > 0.7) {
            anomalies.push({
              type: 'unusual_tool',
              severity: 'medium',
              message: `工具 "${tool}" 占比 ${(ratio * 100).toFixed(1)}%（${count}/${totalCalls}），可能存在过度依赖`,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    }

    // 检测PII泄露风险（输出中包含疑似PII关键词）
    const piiPatterns = /\b(密码|password|secret|token|api[_-]?key|credit.?card|身份证|ssn)\b/i;
    for (const r of records) {
      const outputStr = JSON.stringify(r.output);
      if (piiPatterns.test(outputStr)) {
        anomalies.push({
          type: 'pii_leak',
          severity: 'critical',
          message: `记录 ${r.id} 输出疑似包含敏感信息（密码/token/密钥等）`,
          recordId: r.id,
          timestamp: r.timestamp,
        });
      }
    }

    return anomalies;
  }
}
