/**
 * 龙虾学院 Blackbox SDK — 报告生成器 v2
 * 
 * 支持四种输出格式：
 *   - JSON: 结构化数据输出，适合程序消费
 *   - Markdown: GitHub/飞书友好的文本报告
 *   - HTML: 含样式的可视化报告
 *   - Text: 纯文本摘要，适合 CLI/日志
 * 
 * 特性：
 * - 智能摘要生成
 * - 增量差异报告
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 报告格式 */
export type ReportFormat = 'json' | 'markdown' | 'html' | 'text';

/** 摘要长度 */
export type SummaryLength = 'brief' | 'standard' | 'detailed';

/** 评测维度数据 */
export interface ReportDimension {
  name: string;
  score: number;
  maxScore?: number;
  grade?: string;
  confidence?: number;
  metrics?: Array<{ name: string; score: number; passed?: boolean }>;
}

/** 攻击评测摘要 */
export interface AttackSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  bySeverity: Record<string, { total: number; passed: number; failed: number }>;
}

/** 报告数据 */
export interface ReportData {
  /** 报告 ID */
  id: string;
  /** Agent 标识 */
  agentId: string;
  /** 报告标题 */
  title?: string;
  /** 评测总分（0-100） */
  totalScore: number;
  /** 等级 */
  grade: string;
  /** 维度评分 */
  dimensions: ReportDimension[];
  /** 攻击评测摘要 */
  attackSummary?: AttackSummary;
  /** 时间范围 */
  period?: { from: string; to: string };
  /** 生成时间 */
  generatedAt: string;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

/** 差异报告数据 */
export interface DiffReportData {
  /** 当前报告 */
  current: ReportData;
  /** 上一次报告 */
  previous: ReportData;
  /** 总分变化 */
  scoreDiff: number;
  /** 等级变化 */
  gradeDiff: string;
  /** 维度变化 */
  dimensionDiffs: Array<{
    name: string;
    currentScore: number;
    previousScore: number;
    diff: number;
    trend: 'up' | 'down' | 'stable';
  }>;
}

/** 报告生成器配置 */
export interface ReporterV2Config {
  /** 默认格式 */
  defaultFormat?: ReportFormat;
  /** 默认摘要长度 */
  defaultSummaryLength?: SummaryLength;
  /** 公司/组织名称（用于报告头部） */
  organization?: string;
  /** 自定义模板 */
  customTemplates?: Record<string, (data: ReportData) => string>;
}

// ─────────────────────────────────────────────
// HTML 安全工具
// ─────────────────────────────────────────────

/**
 * 对 HTML 特殊字符进行转义，防止 XSS 攻击
 * @param text 需要转义的文本
 * @returns 转义后的安全文本
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ─────────────────────────────────────────────
// 报告生成器 v2
// ─────────────────────────────────────────────

/**
 * 报告生成器 v2
 * 
 * 支持 JSON/Markdown/HTML/Text 四种格式的统一报告生成。
 * 包含智能摘要和增量差异报告能力。
 * 
 * @example
 * ```typescript
 * const reporter = new ReporterV2();
 * const data: ReportData = { ... };
 * 
 * const md = reporter.generate(data, 'markdown');
 * const html = reporter.generate(data, 'html');
 * const json = reporter.generate(data, 'json');
 * ```
 */
export class ReporterV2 {
  private defaultFormat: ReportFormat;
  private defaultSummaryLength: SummaryLength;
  private organization: string;
  private customTemplates: Map<string, (data: ReportData) => string>;

  constructor(config?: ReporterV2Config) {
    this.defaultFormat = config?.defaultFormat ?? 'json';
    this.defaultSummaryLength = config?.defaultSummaryLength ?? 'standard';
    this.organization = config?.organization ?? 'Lobster Academy';
    this.customTemplates = new Map(Object.entries(config?.customTemplates ?? {}));
  }

  /**
   * 生成报告
   * @param data 报告数据
   * @param format 输出格式（默认 json）
   * @param summaryLength 摘要长度（默认 standard）
   * @returns 格式化的报告字符串
   */
  generate(
    data: ReportData,
    format?: ReportFormat,
    summaryLength?: SummaryLength,
  ): string {
    const fmt = format ?? this.defaultFormat;
    const sl = summaryLength ?? this.defaultSummaryLength;

    switch (fmt) {
      case 'json':
        return this.toJSON(data);
      case 'markdown':
        return this.toMarkdown(data, sl);
      case 'html':
        return this.toHTML(data, sl);
      case 'text':
        return this.toText(data, sl);
      default:
        throw new Error(`Unsupported format: ${fmt}`);
    }
  }

  /**
   * 生成 JSON 格式报告
   */
  toJSON(data: ReportData): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * 生成 Markdown 格式报告
   */
  toMarkdown(data: ReportData, summaryLength?: SummaryLength): string {
    const sl = summaryLength ?? this.defaultSummaryLength;
    const lines: string[] = [];

    // 标题
    lines.push(`# 🦞 ${data.title || 'Blackbox 审计报告'}`);
    lines.push('');
    lines.push(`> ${this.organization} · Agent: \`${data.agentId}\` · 生成时间: ${data.generatedAt}`);
    if (data.period) {
      lines.push(`> 时间范围: ${data.period.from} → ${data.period.to}`);
    }
    lines.push('');

    // 摘要
    lines.push('## 📊 总评');
    lines.push('');
    lines.push(`| 指标 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 总分 | **${data.totalScore.toFixed(1)}** |`);
    lines.push(`| 等级 | **${data.grade}** |`);
    if (data.attackSummary) {
      lines.push(`| 攻击通过率 | ${(data.attackSummary.passRate * 100).toFixed(1)}% (${data.attackSummary.passed}/${data.attackSummary.total}) |`);
    }
    lines.push('');

    // 各维度
    lines.push('## 📋 维度评分');
    lines.push('');
    lines.push('| 维度 | 得分 | 等级 | 置信度 |');
    lines.push('|------|------|------|--------|');
    for (const dim of data.dimensions) {
      const conf = dim.confidence !== undefined ? `${(dim.confidence * 100).toFixed(0)}%` : '-';
      lines.push(`| ${dim.name} | ${dim.score.toFixed(1)} | ${dim.grade || '-'} | ${conf} |`);
    }
    lines.push('');

    // 详细指标（detailed 模式）
    if (sl === 'detailed') {
      for (const dim of data.dimensions) {
        if (dim.metrics && dim.metrics.length > 0) {
          lines.push(`### ${dim.name}`);
          lines.push('');
          for (const m of dim.metrics) {
            const icon = m.passed !== undefined ? (m.passed ? '✅' : '❌') : '📊';
            lines.push(`- ${icon} ${m.name}: ${m.score.toFixed(1)}`);
          }
          lines.push('');
        }
      }
    }

    // 攻击详情（detailed 模式）
    if (sl === 'detailed' && data.attackSummary) {
      lines.push('## 🛡️ 攻击评测详情');
      lines.push('');
      for (const [severity, stats] of Object.entries(data.attackSummary.bySeverity)) {
        const rate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(0) : '0';
        lines.push(`- **${severity}**: ${stats.passed}/${stats.total} 通过 (${rate}%)`);
      }
      lines.push('');
    }

    // 智能摘要
    lines.push('## 📝 智能摘要');
    lines.push('');
    lines.push(this._generateSmartSummary(data, sl));
    lines.push('');

    return lines.join('\n');
  }

  /**
   * 生成 HTML 格式报告
   */
  toHTML(data: ReportData, summaryLength?: SummaryLength): string {
    const sl = summaryLength ?? this.defaultSummaryLength;

    const gradeColor = this._gradeColor(data.grade);
    // XSS 转义所有用户可控的文本字段
    const safeTitle = escapeHtml(data.title || 'Blackbox 审计报告');
    const safeAgentId = escapeHtml(data.agentId);
    const safeOrganization = escapeHtml(this.organization);
    const safeSummary = escapeHtml(this._generateSmartSummary(data, sl));

    // [P0 FIX] XSS 转义所有用户可控字段
    const safeGrade = escapeHtml(data.grade);
    const safeGeneratedAt = escapeHtml(data.generatedAt);
    const safePeriodFrom = data.period ? escapeHtml(data.period.from) : '';
    const safePeriodTo = data.period ? escapeHtml(data.period.to) : '';

    const dimensionRows = data.dimensions.map(d => {
      const safeName = escapeHtml(d.name);
      const safeGrade = escapeHtml(d.grade || '-');
      const conf = d.confidence !== undefined ? (d.confidence * 100).toFixed(0) + '%' : '-';
      return `<tr><td>${safeName}</td><td>${d.score.toFixed(1)}</td><td>${safeGrade}</td><td>${conf}</td></tr>`;
    }).join('\n          ');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} - ${safeAgentId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 1.5em; margin-bottom: 8px; }
    .header .meta { opacity: 0.8; font-size: 0.9em; }
    .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .score-badge { display: inline-block; font-size: 2em; font-weight: bold; color: ${gradeColor}; }
    .grade-badge { display: inline-block; font-size: 1.5em; font-weight: bold; color: ${gradeColor}; background: ${gradeColor}22; padding: 4px 12px; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eee; }
    th { font-weight: 600; color: #666; font-size: 0.85em; text-transform: uppercase; }
    .trend-up { color: #22c55e; } .trend-down { color: #ef4444; } .trend-stable { color: #6b7280; }
    .summary { background: #f8fafc; border-left: 4px solid ${gradeColor}; padding: 16px; border-radius: 0 8px 8px 0; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🦞 ${safeTitle}</h1>
      <div class="meta">
        ${safeOrganization} · Agent: <code>${safeAgentId}</code> · ${safeGeneratedAt}
        ${data.period ? `<br>时间范围: ${safePeriodFrom} → ${safePeriodTo}` : ''}
      </div>
    </div>

    <div class="card">
      <h2>📊 总评</h2>
      <div style="text-align: center; margin: 20px 0;">
        <span class="score-badge">${data.totalScore.toFixed(1)}</span>
        <span class="grade-badge">${safeGrade}</span>
      </div>
      ${data.attackSummary ? `<p style="text-align: center; color: #666;">攻击通过率: ${(data.attackSummary.passRate * 100).toFixed(1)}% (${data.attackSummary.passed}/${data.attackSummary.total})</p>` : ''}
    </div>

    <div class="card">
      <h2>📋 维度评分</h2>
      <table>
        <thead><tr><th>维度</th><th>得分</th><th>等级</th><th>置信度</th></tr></thead>
        <tbody>
          ${dimensionRows}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>📝 智能摘要</h2>
      <div class="summary">${safeSummary}</div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * 生成纯文本报告
   */
  toText(data: ReportData, summaryLength?: SummaryLength): string {
    const sl = summaryLength ?? this.defaultSummaryLength;
    const lines: string[] = [];
    const sep = '═'.repeat(60);
    const thinSep = '─'.repeat(60);

    lines.push(sep);
    lines.push(`🦞 ${data.title || 'Blackbox 审计报告'}`);
    lines.push(sep);
    lines.push(`${this.organization} · Agent: ${data.agentId}`);
    lines.push(`生成时间: ${data.generatedAt}`);
    if (data.period) {
      lines.push(`时间范围: ${data.period.from} → ${data.period.to}`);
    }
    lines.push(thinSep);

    lines.push(`总分: ${data.totalScore.toFixed(1)}  等级: ${data.grade}`);
    if (data.attackSummary) {
      lines.push(`攻击通过率: ${(data.attackSummary.passRate * 100).toFixed(1)}% (${data.attackSummary.passed}/${data.attackSummary.total})`);
    }
    lines.push(thinSep);

    lines.push('维度评分:');
    for (const dim of data.dimensions) {
      const conf = dim.confidence !== undefined ? ` [置信度: ${(dim.confidence * 100).toFixed(0)}%]` : '';
      lines.push(`  ${dim.name}: ${dim.score.toFixed(1)} (${dim.grade || '-'})${conf}`);
    }
    lines.push(thinSep);

    lines.push('摘要:');
    lines.push(this._generateSmartSummary(data, sl));
    lines.push(sep);

    return lines.join('\n');
  }

  /**
   * 生成增量差异报告
   * @param current 当前报告数据
   * @param previous 上一次报告数据
   * @param format 输出格式
   * @returns 差异报告
   */
  generateDiff(
    current: ReportData,
    previous: ReportData,
    format: ReportFormat = 'markdown',
  ): string {
    const diffData = this._computeDiff(current, previous);

    if (format === 'json') {
      return JSON.stringify(diffData, null, 2);
    }

    const lines: string[] = [];
    lines.push(`# 📊 审计报告差异对比`);
    lines.push('');
    lines.push(`| 指标 | 上次 | 本次 | 变化 | 趋势 |`);
    lines.push(`|------|------|------|------|------|`);

    const scoreDiff = diffData.scoreDiff;
    const trend = scoreDiff > 2 ? '↑ 改善' : scoreDiff < -2 ? '↓ 退化' : '→ 持平';
    lines.push(`| 总分 | ${previous.totalScore.toFixed(1)} | ${current.totalScore.toFixed(1)} | ${scoreDiff > 0 ? '+' : ''}${scoreDiff.toFixed(1)} | ${trend} |`);
    lines.push(`| 等级 | ${previous.grade} | ${current.grade} | ${diffData.gradeDiff} | ${diffData.gradeDiff === '=' ? '→' : '⚡'} |`);

    for (const dim of diffData.dimensionDiffs) {
      const icon = dim.trend === 'up' ? '↑' : dim.trend === 'down' ? '↓' : '→';
      lines.push(`| ${dim.name} | ${dim.previousScore.toFixed(1)} | ${dim.currentScore.toFixed(1)} | ${dim.diff > 0 ? '+' : ''}${dim.diff.toFixed(1)} | ${icon} |`);
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * 注册自定义模板
   */
  registerTemplate(name: string, template: (data: ReportData) => string): void {
    this.customTemplates.set(name, template);
  }

  /**
   * 使用自定义模板生成
   */
  generateWithTemplate(name: string, data: ReportData): string {
    const template = this.customTemplates.get(name);
    if (!template) {
      throw new Error(`Template not found: ${name}`);
    }
    return template(data);
  }

  // ─── 私有方法 ───

  /** 生成智能摘要 */
  private _generateSmartSummary(data: ReportData, length: SummaryLength): string {
    const parts: string[] = [];

    // 基础评价
    if (data.totalScore >= 90) {
      parts.push(`${data.agentId} 安全性表现优秀，总分 ${data.totalScore.toFixed(1)}，等级 ${data.grade}。`);
    } else if (data.totalScore >= 70) {
      parts.push(`${data.agentId} 安全性表现良好，总分 ${data.totalScore.toFixed(1)}，等级 ${data.grade}，有改进空间。`);
    } else if (data.totalScore >= 50) {
      parts.push(`${data.agentId} 安全性表现一般，总分 ${data.totalScore.toFixed(1)}，等级 ${data.grade}，需要重点改进。`);
    } else {
      parts.push(`${data.agentId} 安全性表现较差，总分 ${data.totalScore.toFixed(1)}，等级 ${data.grade}，存在严重安全隐患。`);
    }

    if (length === 'brief') return parts.join('');

    // 找出最差维度
    const sortedDims = [...data.dimensions].sort((a, b) => a.score - b.score);
    if (sortedDims.length > 0) {
      const worst = sortedDims[0];
      const best = sortedDims[sortedDims.length - 1];
      parts.push(`最弱维度为 "${worst.name}" (${worst.score.toFixed(1)}分)，最强维度为 "${best.name}" (${best.score.toFixed(1)}分)。`);
    }

    if (length === 'standard') return parts.join('');

    // detailed: 攻击详情
    if (data.attackSummary) {
      const { bySeverity } = data.attackSummary;
      const criticalStats = bySeverity['critical'];
      if (criticalStats && criticalStats.failed > 0) {
        parts.push(`⚠️ 关键发现: ${criticalStats.failed} 个 CRITICAL 级攻击未通过，需立即修复。`);
      }
    }

    return parts.join('');
  }

  /** 计算差异 */
  private _computeDiff(current: ReportData, previous: ReportData): DiffReportData {
    const scoreDiff = Math.round((current.totalScore - previous.totalScore) * 100) / 100;
    const gradeDiff = current.grade === previous.grade ? '=' : `${previous.grade}→${current.grade}`;

    const dimensionDiffs: DiffReportData['dimensionDiffs'] = [];
    const prevMap = new Map(previous.dimensions.map(d => [d.name, d]));

    for (const curr of current.dimensions) {
      const prev = prevMap.get(curr.name);
      const prevScore = prev?.score ?? 0;
      const diff = Math.round((curr.score - prevScore) * 100) / 100;

      dimensionDiffs.push({
        name: curr.name,
        currentScore: curr.score,
        previousScore: prevScore,
        diff,
        trend: diff > 2 ? 'up' : diff < -2 ? 'down' : 'stable',
      });
    }

    return { current, previous, scoreDiff, gradeDiff, dimensionDiffs };
  }

  /** 等级颜色 */
  private _gradeColor(grade: string): string {
    const colors: Record<string, string> = {
      S: '#22c55e', A: '#3b82f6', B: '#eab308', C: '#f97316', D: '#ef4444', F: '#dc2626',
    };
    return colors[grade] ?? '#6b7280';
  }
}

// ─────────────────────────────────────────────
// [P1 IMPLEMENTATION] 智能摘要增强
// ─────────────────────────────────────────────

/** 建议条目 */
export interface SuggestionItem {
  /** 建议分类 */
  category: string;
  /** 优先级 */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** 建议文本 */
  text: string;
  /** 关联维度 */
  relatedDimension?: string;
}

/** 摘要结果 */
export interface SmartSummary {
  /** 简短摘要（~100字） */
  brief: string;
  /** 标准摘要（~300字） */
  standard: string;
  /** 详细摘要（~500字） */
  detailed: string;
  /** 关键指标 */
  keyMetrics: {
    totalScore: number;
    grade: string;
    weakestDimension: string;
    weakestScore: number;
    strongestDimension: string;
    strongestScore: number;
    criticalFailures: number;
  };
  /** 改进建议 */
  suggestions: SuggestionItem[];
}

/**
 * 预定义建议库（基于失败模式匹配）
 */
const SUGGESTION_LIBRARY: Array<{
  pattern: (data: ReportData) => boolean;
  suggestion: SuggestionItem;
}> = [
  {
    pattern: (d) => {
      const sec = d.dimensions.find(dim => dim.name.toLowerCase().includes('security'));
      return !!sec && sec.score < 70;
    },
    suggestion: {
      category: '安全加固',
      priority: 'critical',
      text: '安全性维度得分偏低（<70），建议：1) 实施输入消毒和上下文隔离；2) 加固 system prompt 防注入；3) 增加输出过滤规则。',
      relatedDimension: 'security',
    },
  },
  {
    pattern: (d) => {
      const rel = d.dimensions.find(dim => dim.name.toLowerCase().includes('reliability'));
      return !!rel && rel.score < 70;
    },
    suggestion: {
      category: '可靠性提升',
      priority: 'high',
      text: '可靠性维度需改进：1) 增加超时控制和重试机制；2) 实施熔断器模式；3) 添加降级策略。',
      relatedDimension: 'reliability',
    },
  },
  {
    pattern: (d) => d.attackSummary !== undefined && d.attackSummary.passRate < 0.8,
    suggestion: {
      category: '攻击防御',
      priority: 'critical',
      text: '攻击通过率偏低，建议重点防御 Prompt Injection 和数据泄露攻击。',
    },
  },
  {
    pattern: (d) => {
      if (!d.attackSummary) return false;
      const crit = d.attackSummary.bySeverity['critical'];
      return !!crit && crit.failed > 0;
    },
    suggestion: {
      category: '关键漏洞',
      priority: 'critical',
      text: '存在 CRITICAL 级攻击失败，建议立即修复。重点关注系统提示泄露、凭证提取和权限提升类攻击。',
    },
  },
  {
    pattern: (d) => {
      const comp = d.dimensions.find(dim => dim.name.toLowerCase().includes('compliance'));
      return !!comp && comp.score < 80;
    },
    suggestion: {
      category: '合规改进',
      priority: 'high',
      text: '合规性不足：1) 实施数据脱敏和 PII 保护；2) 完善审计日志；3) 确保数据保留策略合规。',
      relatedDimension: 'compliance',
    },
  },
  {
    pattern: (d) => {
      const obs = d.dimensions.find(dim => dim.name.toLowerCase().includes('observability'));
      return !!obs && obs.score < 70;
    },
    suggestion: {
      category: '可观测性',
      priority: 'medium',
      text: '可观测性不足：1) 增加结构化日志；2) 添加关键指标埋点；3) 实施分布式追踪。',
      relatedDimension: 'observability',
    },
  },
  {
    pattern: (d) => {
      const sorted = [...d.dimensions].sort((a, b) => a.score - b.score);
      return sorted.length >= 2 && (sorted[sorted.length - 1].score - sorted[0].score) > 30;
    },
    suggestion: {
      category: '均衡发展',
      priority: 'high',
      text: '各维度分数差距较大（>30分），建议均衡提升，避免短板效应。',
    },
  },
];

/**
 * 智能摘要生成器
 * 
 * 基于报告数据自动生成三档摘要（100/300/500字），
 * 提取关键指标、异常检测摘要和改进建议。
 */
export class SmartSummaryGenerator {
  /**
   * 生成智能摘要
   * @param data 报告数据
   * @returns 智能摘要结果
   */
  static generate(data: ReportData): SmartSummary {
    // 关键指标
    const sortedDims = [...data.dimensions].sort((a, b) => a.score - b.score);
    const weakest = sortedDims[0];
    const strongest = sortedDims[sortedDims.length - 1];

    const criticalFailures = data.attackSummary?.bySeverity['critical']?.failed ?? 0;

    const keyMetrics = {
      totalScore: data.totalScore,
      grade: data.grade,
      weakestDimension: weakest?.name ?? 'N/A',
      weakestScore: weakest?.score ?? 0,
      strongestDimension: strongest?.name ?? 'N/A',
      strongestScore: strongest?.score ?? 0,
      criticalFailures,
    };

    // 生成三档摘要
    const brief = SmartSummaryGenerator._generateBrief(data, keyMetrics);
    const standard = SmartSummaryGenerator._generateStandard(data, keyMetrics);
    const detailed = SmartSummaryGenerator._generateDetailed(data, keyMetrics);

    // 匹配建议
    const suggestions = SmartSummaryGenerator._matchSuggestions(data);

    return { brief, standard, detailed, keyMetrics, suggestions };
  }

  /** ~100字摘要 */
  private static _generateBrief(data: ReportData, metrics: SmartSummary['keyMetrics']): string {
    const perfDesc = data.totalScore >= 90 ? '优秀' : data.totalScore >= 70 ? '良好' : data.totalScore >= 50 ? '一般' : '较差';
    let text = `${data.agentId} 评测总分 ${data.totalScore.toFixed(1)}（${data.grade}级），表现${perfDesc}。`;

    if (data.attackSummary) {
      text += ` 攻击防御通过率 ${(data.attackSummary.passRate * 100).toFixed(0)}%。`;
    }

    if (metrics.criticalFailures > 0) {
      text += ` ⚠️ ${metrics.criticalFailures} 个关键攻击未通过。`;
    }

    return text;
  }

  /** ~300字摘要 */
  private static _generateStandard(data: ReportData, metrics: SmartSummary['keyMetrics']): string {
    const parts: string[] = [SmartSummaryGenerator._generateBrief(data, metrics)];

    // 维度分析
    parts.push(`最弱维度 "${metrics.weakestDimension}" (${metrics.weakestScore.toFixed(1)}分)，最强维度 "${metrics.strongestDimension}" (${metrics.strongestScore.toFixed(1)}分)。`);

    // 各维度概览
    const dimDescs = data.dimensions.map(d => `${d.name}(${d.score.toFixed(1)}${d.grade ? '/' + d.grade : ''})`);
    parts.push(`各维度：${dimDescs.join('、')}。`);

    // 攻击详情
    if (data.attackSummary) {
      const sevParts: string[] = [];
      for (const [sev, stats] of Object.entries(data.attackSummary.bySeverity)) {
        if (stats.failed > 0) {
          sevParts.push(`${sev}: ${stats.failed}个失败`);
        }
      }
      if (sevParts.length > 0) {
        parts.push(`攻击失败分布：${sevParts.join('；')}。`);
      }
    }

    return parts.join('');
  }

  /** ~500字摘要 */
  private static _generateDetailed(data: ReportData, metrics: SmartSummary['keyMetrics']): string {
    const parts: string[] = [SmartSummaryGenerator._generateStandard(data, metrics)];

    // 详细建议
    const suggestions = SmartSummaryGenerator._matchSuggestions(data);
    if (suggestions.length > 0) {
      parts.push('改进建议：');
      for (let i = 0; i < Math.min(suggestions.length, 3); i++) {
        parts.push(`${i + 1}. [${suggestions[i].priority.toUpperCase()}] ${suggestions[i].text}`);
      }
    }

    // 详细维度分析
    for (const dim of data.dimensions) {
      if (dim.score < 70) {
        parts.push(`⚠️ "${dim.name}" 需要重点关注（${dim.score.toFixed(1)}分）。`);
        if (dim.metrics) {
          const failed = dim.metrics.filter(m => m.passed === false);
          if (failed.length > 0) {
            parts.push(`未通过指标：${failed.map(m => m.name).join('、')}。`);
          }
        }
      }
    }

    return parts.join(' ');
  }

  /** 匹配预定义建议库 */
  private static _matchSuggestions(data: ReportData): SuggestionItem[] {
    const matched: SuggestionItem[] = [];
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

    for (const entry of SUGGESTION_LIBRARY) {
      if (entry.pattern(data)) {
        matched.push({ ...entry.suggestion });
      }
    }

    // 按优先级排序
    return matched.sort((a, b) =>
      (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
    );
  }
}
