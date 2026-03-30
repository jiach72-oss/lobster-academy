/**
 * 明镜 Blackbox SDK — 合规报告导出器
 * 支持 HTML、JSON、Markdown 格式导出
 */

import { EUAIActReport } from './eu-ai-act';
import { SOC2Report } from './soc2';

/** 合规报告类型 */
export type ComplianceReport = EUAIActReport | SOC2Report;

/**
 * 合规报告导出器
 *
 * 将合规报告导出为多种格式（HTML、JSON、Markdown）。
 *
 * @example
 * ```typescript
 * import { ComplianceExporter } from '@lobster-academy/blackbox/compliance';
 *
 * const exporter = new ComplianceExporter();
 * const html = exporter.toHTML(euAIActReport);
 * const json = exporter.toJSON(soc2Report);
 * const md = exporter.toMarkdown(report);
 * ```
 */
export class ComplianceExporter {
  /**
   * 导出为 HTML 格式（适合浏览器查看或 PDF 转换）
   *
   * @param report 合规报告
   * @returns HTML 字符串
   */
  toHTML(report: ComplianceReport): string {
    if ('systemDescription' in report) {
      return this.euAIActToHTML(report);
    }
    return this.soc2ToHTML(report as SOC2Report);
  }

  /**
   * 导出为 JSON 格式
   *
   * @param report 合规报告
   * @returns 格式化的 JSON 字符串
   */
  toJSON(report: ComplianceReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * 导出为 Markdown 格式
   *
   * @param report 合规报告
   * @returns Markdown 字符串
   */
  toMarkdown(report: ComplianceReport): string {
    if ('systemDescription' in report) {
      return this.euAIActToMarkdown(report);
    }
    return this.soc2ToMarkdown(report as SOC2Report);
  }

  // ─────────────────────────────────────────────
  // EU AI Act 导出
  // ─────────────────────────────────────────────

  private euAIActToHTML(report: EUAIActReport): string {
    const riskColors: Record<string, string> = {
      minimal: '#22c55e',
      limited: '#eab308',
      high: '#f97316',
      unacceptable: '#ef4444',
    };

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>EU AI Act 合规报告 — ${report.systemDescription.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; color: #1a1a1a; }
    h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 0.5rem; }
    h2 { color: #1e3a5f; margin-top: 2rem; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: 600; color: white; }
    .risk-badge { background: ${riskColors[report.systemDescription.riskCategory] || '#6b7280'}; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid #e5e7eb; padding: 0.5rem 1rem; text-align: left; }
    th { background: #f3f4f6; }
    .signature { font-family: monospace; font-size: 0.75rem; color: #6b7280; word-break: break-all; }
    ul { line-height: 1.8; }
  </style>
</head>
<body>
  <h1>🪞 EU AI Act 合规报告</h1>
  <p><strong>报告 ID:</strong> ${report.id}</p>
  <p><strong>生成时间:</strong> ${report.generatedAt}</p>

  <h2>📋 系统描述</h2>
  <table>
    <tr><th>属性</th><th>值</th></tr>
    <tr><td>系统名称</td><td>${this.escapeHtml(report.systemDescription.name)}</td></tr>
    <tr><td>用途</td><td>${this.escapeHtml(report.systemDescription.purpose)}</td></tr>
    <tr><td>风险分类</td><td><span class="badge risk-badge">${report.systemDescription.riskCategory}</span></td></tr>
    <tr><td>框架</td><td>${this.escapeHtml(report.systemDescription.framework.name)} v${this.escapeHtml(report.systemDescription.framework.version)}</td></tr>
    <tr><td>模型</td><td>${this.escapeHtml(report.systemDescription.model.provider)} / ${this.escapeHtml(report.systemDescription.model.name)}</td></tr>
  </table>

  <h2>⚠️ 风险管理</h2>
  <h3>已识别风险</h3>
  <ul>${report.riskManagement.identifiedRisks.map(r => `<li>${this.escapeHtml(r)}</li>`).join('\n')}</ul>
  <h3>缓解措施</h3>
  <ul>${report.riskManagement.mitigationMeasures.map(m => `<li>${this.escapeHtml(m)}</li>`).join('\n')}</ul>
  <h3>残余风险</h3>
  <ul>${report.riskManagement.residualRisks.map(r => `<li>${this.escapeHtml(r)}</li>`).join('\n')}</ul>

  <h2>📊 数据治理</h2>
  <h3>数据来源</h3>
  <ul>${report.dataGovernance.dataSources.map(s => `<li>${this.escapeHtml(s)}</li>`).join('\n')}</ul>
  <h3>处理步骤</h3>
  <ol>${report.dataGovernance.processingSteps.map(s => `<li>${this.escapeHtml(s)}</li>`).join('\n')}</ol>
  <p><strong>保留策略:</strong> ${this.escapeHtml(report.dataGovernance.retentionPolicy)}</p>

  <h2>🔧 技术文档</h2>
  <h3>架构</h3>
  <pre>${this.escapeHtml(report.technicalDocumentation.architecture)}</pre>
  <h3>测试结果</h3>
  <pre>${this.escapeHtml(report.technicalDocumentation.testingResults)}</pre>
  <h3>监控配置</h3>
  <pre>${this.escapeHtml(report.technicalDocumentation.monitoringSetup)}</pre>

  ${report.evaluationSummary ? `
  <h2>🎓 评测摘要</h2>
  <table>
    <tr><th>指标</th><th>值</th></tr>
    <tr><td>最新等级</td><td>${report.evaluationSummary.latestGrade}</td></tr>
    <tr><td>评测次数</td><td>${report.evaluationSummary.evalCount}</td></tr>
    <tr><td>安全</td><td>${report.evaluationSummary.dimensions.security.score}/${report.evaluationSummary.dimensions.security.max}</td></tr>
    <tr><td>可靠性</td><td>${report.evaluationSummary.dimensions.reliability.score}/${report.evaluationSummary.dimensions.reliability.max}</td></tr>
    <tr><td>可观测性</td><td>${report.evaluationSummary.dimensions.observability.score}/${report.evaluationSummary.dimensions.observability.max}</td></tr>
    <tr><td>合规性</td><td>${report.evaluationSummary.dimensions.compliance.score}/${report.evaluationSummary.dimensions.compliance.max}</td></tr>
    <tr><td>可解释性</td><td>${report.evaluationSummary.dimensions.explainability.score}/${report.evaluationSummary.dimensions.explainability.max}</td></tr>
  </table>
  ` : ''}

  ${report.alertSummary ? `
  <h2>🔔 告警摘要</h2>
  <p>总告警数: <strong>${report.alertSummary.total}</strong></p>
  <ul>
    <li>Info: ${report.alertSummary.byLevel.info || 0}</li>
    <li>Warning: ${report.alertSummary.byLevel.warning || 0}</li>
    <li>Critical: ${report.alertSummary.byLevel.critical || 0}</li>
  </ul>
  ${report.alertSummary.criticalAlerts.length > 0 ? `
  <h3>严重告警详情</h3>
  <ul>${report.alertSummary.criticalAlerts.map(a => `<li>${this.escapeHtml(a)}</li>`).join('\n')}</ul>
  ` : ''}
  ` : ''}

  ${report.signature ? `
  <hr>
  <p><strong>Ed25519 签名:</strong></p>
  <p class="signature">${report.signature}</p>
  ` : ''}
</body>
</html>`;
  }

  private euAIActToMarkdown(report: EUAIActReport): string {
    const lines: string[] = [
      `# EU AI Act 合规报告`,
      ``,
      `- **报告 ID:** ${report.id}`,
      `- **生成时间:** ${report.generatedAt}`,
      ``,
      `## 系统描述`,
      ``,
      `| 属性 | 值 |`,
      `|------|-----|`,
      `| 系统名称 | ${report.systemDescription.name} |`,
      `| 用途 | ${report.systemDescription.purpose} |`,
      `| 风险分类 | \`${report.systemDescription.riskCategory}\` |`,
      `| 框架 | ${report.systemDescription.framework.name} v${report.systemDescription.framework.version} |`,
      `| 模型 | ${report.systemDescription.model.provider} / ${report.systemDescription.model.name} |`,
      ``,
      `## 风险管理`,
      ``,
      `### 已识别风险`,
      ...report.riskManagement.identifiedRisks.map(r => `- ${r}`),
      ``,
      `### 缓解措施`,
      ...report.riskManagement.mitigationMeasures.map(m => `- ${m}`),
      ``,
      `### 残余风险`,
      ...report.riskManagement.residualRisks.map(r => `- ${r}`),
      ``,
      `## 数据治理`,
      ``,
      `### 数据来源`,
      ...report.dataGovernance.dataSources.map(s => `- ${s}`),
      ``,
      `### 处理步骤`,
      ...report.dataGovernance.processingSteps.map((s, i) => `${i + 1}. ${s}`),
      ``,
      `**保留策略:** ${report.dataGovernance.retentionPolicy}`,
      ``,
      `## 技术文档`,
      ``,
      `### 架构`,
      `\`\`\``,
      report.technicalDocumentation.architecture,
      `\`\`\``,
      ``,
      `### 测试结果`,
      `\`\`\``,
      report.technicalDocumentation.testingResults,
      `\`\`\``,
      ``,
      `### 监控配置`,
      `\`\`\``,
      report.technicalDocumentation.monitoringSetup,
      `\`\`\``,
    ];

    if (report.evaluationSummary) {
      lines.push(
        ``,
        `## 评测摘要`,
        ``,
        `| 指标 | 值 |`,
        `|------|-----|`,
        `| 最新等级 | ${report.evaluationSummary.latestGrade} |`,
        `| 评测次数 | ${report.evaluationSummary.evalCount} |`,
        `| 安全 | ${report.evaluationSummary.dimensions.security.score}/${report.evaluationSummary.dimensions.security.max} |`,
        `| 可靠性 | ${report.evaluationSummary.dimensions.reliability.score}/${report.evaluationSummary.dimensions.reliability.max} |`,
        `| 可观测性 | ${report.evaluationSummary.dimensions.observability.score}/${report.evaluationSummary.dimensions.observability.max} |`,
        `| 合规性 | ${report.evaluationSummary.dimensions.compliance.score}/${report.evaluationSummary.dimensions.compliance.max} |`,
        `| 可解释性 | ${report.evaluationSummary.dimensions.explainability.score}/${report.evaluationSummary.dimensions.explainability.max} |`,
      );
    }

    if (report.alertSummary) {
      lines.push(
        ``,
        `## 告警摘要`,
        ``,
        `- **总告警数:** ${report.alertSummary.total}`,
        `  - Info: ${report.alertSummary.byLevel.info || 0}`,
        `  - Warning: ${report.alertSummary.byLevel.warning || 0}`,
        `  - Critical: ${report.alertSummary.byLevel.critical || 0}`,
      );
      if (report.alertSummary.criticalAlerts.length > 0) {
        lines.push(``, `### 严重告警详情`, ...report.alertSummary.criticalAlerts.map(a => `- ${a}`));
      }
    }

    if (report.signature) {
      lines.push(``, `---`, `**Ed25519 签名:** \`${report.signature}\``);
    }

    return lines.join('\n');
  }

  // ─────────────────────────────────────────────
  // SOC2 导出
  // ─────────────────────────────────────────────

  private soc2ToHTML(report: SOC2Report): string {
    const statusIcons: Record<string, string> = {
      pass: '✅ 通过',
      partial: '⚠️ 部分通过',
      fail: '❌ 未通过',
    };

    const criteriaNames: Record<string, string> = {
      security: '安全性',
      availability: '可用性',
      processingIntegrity: '处理完整性',
      confidentiality: '保密性',
      privacy: '隐私',
    };

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>SOC2 审计报告 — ${report.agentId}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; color: #1a1a1a; }
    h1 { color: #059669; border-bottom: 2px solid #059669; padding-bottom: 0.5rem; }
    h2 { color: #065f46; margin-top: 2rem; }
    .status-pass { color: #22c55e; font-weight: bold; }
    .status-partial { color: #eab308; font-weight: bold; }
    .status-fail { color: #ef4444; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid #e5e7eb; padding: 0.5rem 1rem; text-align: left; }
    th { background: #f3f4f6; }
    .signature { font-family: monospace; font-size: 0.75rem; color: #6b7280; word-break: break-all; }
    ul { line-height: 1.8; }
  </style>
</head>
<body>
  <h1>🪞 SOC2 审计报告</h1>
  <p><strong>报告 ID:</strong> ${report.id}</p>
  <p><strong>Agent:</strong> ${this.escapeHtml(report.agentId)}</p>
  <p><strong>审计期间:</strong> ${report.auditPeriod.start} — ${report.auditPeriod.end}</p>
  <p><strong>生成时间:</strong> ${report.generatedAt}</p>

  <h2>📊 信任服务标准</h2>
  <table>
    <tr><th>标准</th><th>状态</th><th>证据</th></tr>
    ${Object.entries(report.criteria).map(([key, entry]) => {
      const safeKey = this.escapeHtml(criteriaNames[key] || key);
      const safeStatus = this.escapeHtml(entry.status);
      const safeStatusIcon = this.escapeHtml(statusIcons[entry.status]);
      const evidenceHtml = entry.evidence.map(e => `<li>${this.escapeHtml(e)}</li>`).join('');
      return `
    <tr>
      <td><strong>${safeKey}</strong></td>
      <td class="status-${safeStatus}">${safeStatusIcon}</td>
      <td><ul>${evidenceHtml}</ul></td>
    </tr>`;
    }).join('')}
  </table>

  <h2>📋 证据摘要</h2>
  <table>
    <tr><th>指标</th><th>值</th></tr>
    <tr><td>总事件数</td><td>${report.evidenceSummary.totalEvents}</td></tr>
    <tr><td>审计期间</td><td>${report.evidenceSummary.periodStart} — ${report.evidenceSummary.periodEnd}</td></tr>
    <tr><td>检测异常数</td><td>${report.evidenceSummary.anomaliesDetected}</td></tr>
    <tr><td>已解决异常数</td><td>${report.evidenceSummary.anomaliesResolved}</td></tr>
  </table>

  ${report.signature ? `
  <hr>
  <p><strong>Ed25519 签名:</strong></p>
  <p class="signature">${report.signature}</p>
  ` : ''}
</body>
</html>`;
  }

  private soc2ToMarkdown(report: SOC2Report): string {
    const statusIcons: Record<string, string> = {
      pass: '✅ 通过',
      partial: '⚠️ 部分通过',
      fail: '❌ 未通过',
    };
    const criteriaNames: Record<string, string> = {
      security: '安全性',
      availability: '可用性',
      processingIntegrity: '处理完整性',
      confidentiality: '保密性',
      privacy: '隐私',
    };

    const lines: string[] = [
      `# SOC2 审计报告`,
      ``,
      `- **报告 ID:** ${report.id}`,
      `- **Agent:** ${report.agentId}`,
      `- **审计期间:** ${report.auditPeriod.start} — ${report.auditPeriod.end}`,
      `- **生成时间:** ${report.generatedAt}`,
      ``,
      `## 信任服务标准`,
    ];

    for (const [key, entry] of Object.entries(report.criteria)) {
      lines.push(
        ``,
        `### ${criteriaNames[key] || key}: ${statusIcons[entry.status]}`,
        ``,
        ...entry.evidence.map(e => `- ${e}`),
      );
    }

    lines.push(
      ``,
      `## 证据摘要`,
      ``,
      `| 指标 | 值 |`,
      `|------|-----|`,
      `| 总事件数 | ${report.evidenceSummary.totalEvents} |`,
      `| 审计期间 | ${report.evidenceSummary.periodStart} — ${report.evidenceSummary.periodEnd} |`,
      `| 检测异常数 | ${report.evidenceSummary.anomaliesDetected} |`,
      `| 已解决异常数 | ${report.evidenceSummary.anomaliesResolved} |`,
    );

    if (report.signature) {
      lines.push(``, `---`, `**Ed25519 签名:** \`${report.signature}\``);
    }

    return lines.join('\n');
  }

  /** HTML 转义 */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
