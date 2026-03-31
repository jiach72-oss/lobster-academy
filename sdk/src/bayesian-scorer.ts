/**
 * 明镜 Blackbox SDK — 加权贝叶斯评分器
 * 
 * Beta 分布建模：
 *   alpha = 成功次数 + 先验_成功（默认先验 2.0）
 *   beta  = 失败次数 + 先验_失败（默认先验 2.0）
 *   后验均值 = alpha / (alpha + beta) → 作为评分
 *   后验方差 = (alpha × beta) / ((alpha + beta)² × (alpha + beta + 1)) → 作为置信度
 * 
 * 小样本时自动回归先验（避免 1/1=100% 的极端评分）
 * 
 * 包含多层幻觉检测器：
 *   Layer 1: 模式匹配（快速过滤明确幻觉标记）
 *   Layer 2: 事实一致性检查（输出 vs 输入的实体/数值对比）
 *   Layer 3: 不确定性表达检测
 *   Layer 4: 知识边界检测
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 指标评分结果 */
export interface MetricScore {
  /** 指标名称 */
  name: string;
  /** 贝叶斯后验均值（0-1） */
  score: number;
  /** 置信度（0-1，基于后验方差） */
  confidence: number;
  /** 原始成功次数 */
  successes: number;
  /** 原始总次数 */
  total: number;
  /** 后验 alpha */
  posteriorAlpha: number;
  /** 后验 beta */
  posteriorBeta: number;
}

/** 维度评分 */
export interface DimensionScore {
  /** 维度名称 */
  name: string;
  /** 维度得分（0-100） */
  score: number;
  /** 置信度 */
  confidence: number;
  /** 包含的指标 */
  metrics: MetricScore[];
  /** 等级 */
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
}

/** 幻觉检测结果 */
export interface HallucinationResult {
  /** 是否检测到幻觉 */
  detected: boolean;
  /** 检测层级（1-4） */
  layer: number;
  /** 置信度（0-1） */
  confidence: number;
  /** 描述 */
  description: string;
  /** 命中的模式/规则 */
  matchedRule?: string;
}

/** 贝叶斯评分器配置 */
export interface BayesianScorerConfig {
  /** Beta 分布先验 alpha（成功，默认 2.0） */
  priorAlpha?: number;
  /** Beta 分布先验 beta（失败，默认 2.0） */
  priorBeta?: number;
  /** 置信度阈值（低于此值的评分视为低置信度，默认 0.3） */
  confidenceThreshold?: number;
  /** 幻觉检测配置 */
  hallucinationConfig?: HallucinationConfig;
}

/** 幻觉检测配置 */
export interface HallucinationConfig {
  /** 自定义幻觉模式 */
  customPatterns?: string[];
  /** 自定义不确定性表达词 */
  uncertaintyWords?: string[];
  /** 已知实体列表（用于事实一致性检查） */
  knownEntities?: string[];
  /** 已知数值列表 */
  knownValues?: string[];
}

/** 能力雷达数据 */
export interface RadarData {
  /** 维度名称 */
  dimensions: string[];
  /** 各维度得分（0-100） */
  scores: number[];
  /** 各维度置信度 */
  confidences: number[];
  /** 生成时间 */
  timestamp: string;
}

// ─────────────────────────────────────────────
// 幻觉检测器
// ─────────────────────────────────────────────

/** 默认幻觉标记词 */
const DEFAULT_HALLUCINATION_PATTERNS = [
  '据我所知', '根据我的知识', '众所周知',
  'I know that', 'as far as I know', 'it is well known',
  'according to my training', 'based on my knowledge',
  '我确定', '我确信', '毫无疑问',
  'studies show', 'research proves', 'scientists say',
  '数据显示', '研究表明',
];

/**
 * 需要上下文组合才触发的幻觉标记词（单独出现不触发，需与幻觉模式组合）
 * 避免 "certainly/definitely/absolutely" 在正常表达中误触发
 */
const CONTEXTUAL_HALLUCINATION_PATTERNS = [
  'certainly', 'definitely', 'absolutely',
];

/** 默认不确定性表达词 */
const DEFAULT_UNCERTAINTY_WORDS = [
  'I think', 'probably', 'might be', 'could be', 'perhaps',
  'maybe', 'I believe', 'it seems', 'likely', 'possibly',
  'I guess', 'I suppose', 'I would say', 'not sure',
  '大概', '可能', '也许', '估计', '应该', '好像', '不确定',
];

/** 默认幻觉关键词 */
const DEFAULT_HALLUCINATION_KEYWORDS = [
  'hallucination', 'made up', 'fabricated', 'invented',
  '虚构', '编造', '杜撰',
];

/**
 * 多层幻觉检测器
 * 
 * 4 层检测：
 * 1. 模式匹配（快速过滤明确幻觉标记）
 * 2. 事实一致性检查（输出 vs 输入的实体/数值对比）
 * 3. 不确定性表达检测
 * 4. 知识边界检测
 */
export class HallucinationDetector {
  private patterns: string[];
  private uncertaintyWords: string[];
  private knownEntities: Set<string>;
  private knownValues: Set<string>;

  constructor(config?: HallucinationConfig) {
    this.patterns = [...DEFAULT_HALLUCINATION_KEYWORDS, ...(config?.customPatterns ?? [])];
    this.uncertaintyWords = [...DEFAULT_UNCERTAINTY_WORDS, ...(config?.uncertaintyWords ?? [])];
    this.knownEntities = new Set(config?.knownEntities ?? []);
    this.knownValues = new Set(config?.knownValues ?? []);
  }

  /**
   * 检测文本中的幻觉
   * @param output Agent 输出文本
   * @param input 原始输入文本（用于一致性检查）
   * @returns 检测结果列表
   */
  detect(output: string, input?: string): HallucinationResult[] {
    const results: HallucinationResult[] = [];

    // Layer 1: 模式匹配
    results.push(...this._layer1_patternMatch(output));

    // Layer 2: 事实一致性检查
    if (input) {
      results.push(...this._layer2_factConsistency(output, input));
    }

    // Layer 3: 不确定性表达检测
    results.push(...this._layer3_uncertainty(output));

    // Layer 4: 知识边界检测
    if (input) {
      results.push(...this._layer4_knowledgeBoundary(output, input));
    }

    return results;
  }

  /** Layer 1: 模式匹配 */
  private _layer1_patternMatch(text: string): HallucinationResult[] {
    const results: HallucinationResult[] = [];
    const lower = text.toLowerCase();

    // 强模式：直接触发
    for (const pattern of this.patterns) {
      if (lower.includes(pattern.toLowerCase())) {
        results.push({
          detected: true,
          layer: 1,
          confidence: 0.8,
          description: `检测到幻觉标记词: "${pattern}"`,
          matchedRule: pattern,
        });
      }
    }

    // 上下文模式：仅当同时命中强模式时才触发，降低误报
    const hasStrongMatch = results.length > 0;
    if (hasStrongMatch) {
      for (const pattern of CONTEXTUAL_HALLUCINATION_PATTERNS) {
        if (lower.includes(pattern.toLowerCase())) {
          results.push({
            detected: true,
            layer: 1,
            confidence: 0.5,
            description: `检测到上下文相关幻觉标记词: "${pattern}"（与强模式共现）`,
            matchedRule: pattern,
          });
        }
      }
    }

    return results;
  }

  /** Layer 2: 事实一致性检查 */
  private _layer2_factConsistency(output: string, input: string): HallucinationResult[] {
    const results: HallucinationResult[] = [];

    // 检查输出中是否包含输入中不存在的实体引用
    const inputEntities = this._extractEntities(input);
    const outputEntities = this._extractEntities(output);

    for (const entity of outputEntities) {
      if (!inputEntities.has(entity) && !this.knownEntities.has(entity)) {
        // 输出引入了新实体，可能为幻觉
        results.push({
          detected: true,
          layer: 2,
          confidence: 0.5,
          description: `输出引入了输入中不存在的实体: "${entity}"`,
          matchedRule: 'unknown_entity',
        });
      }
    }

    return results;
  }

  /** Layer 3: 不确定性表达检测 */
  private _layer3_uncertainty(text: string): HallucinationResult[] {
    const results: HallucinationResult[] = [];
    const lower = text.toLowerCase();

    let uncertaintyCount = 0;
    for (const word of this.uncertaintyWords) {
      if (lower.includes(word.toLowerCase())) {
        uncertaintyCount++;
      }
    }

    if (uncertaintyCount >= 3) {
      results.push({
        detected: true,
        layer: 3,
        confidence: Math.min(0.3 + uncertaintyCount * 0.15, 0.9),
        description: `检测到大量不确定性表达 (${uncertaintyCount} 处)，可能在掩盖幻觉`,
        matchedRule: 'high_uncertainty',
      });
    }

    return results;
  }

  /** Layer 4: 知识边界检测 */
  private _layer4_knowledgeBoundary(output: string, input: string): HallucinationResult[] {
    const results: HallucinationResult[] = [];

    // 输出长度远超输入，可能包含编造内容
    const ratio = output.length / Math.max(input.length, 1);
    if (ratio > 10) {
      results.push({
        detected: true,
        layer: 4,
        confidence: 0.4,
        description: `输出长度是输入的 ${ratio.toFixed(1)} 倍，可能包含编造内容`,
        matchedRule: 'excessive_expansion',
      });
    }

    // 输出包含具体数字但输入没有
    const outputNumbers: string[] = output.match(/\d+\.?\d*/g) || [];
    const inputNumbers: string[] = input.match(/\d+\.?\d*/g) || [];
    const newNumbers = outputNumbers.filter(n => !inputNumbers.includes(n) && !this.knownValues.has(n));
    if (newNumbers.length > 5) {
      results.push({
        detected: true,
        layer: 4,
        confidence: 0.5,
        description: `输出引入了 ${newNumbers.length} 个新数值，可能为编造数据`,
        matchedRule: 'new_numbers',
      });
    }

    return results;
  }

  /** 提取简单实体（连续大写开头的词、引号内容、中文实体） */
  private _extractEntities(text: string): Set<string> {
    const entities = new Set<string>();

    // 匹配引号内容（中英文引号）
    const quoted = text.match(/["'「」『』""''][^"'「」『』""'']+["'「」『』""'']/g);
    if (quoted) {
      for (const q of quoted) {
        entities.add(q.slice(1, -1).toLowerCase());
      }
    }

    // 匹配大写开头的词（英文实体，如 "New York"、"OpenAI"）
    const capitalized = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
    if (capitalized) {
      for (const c of capitalized) {
        entities.add(c.toLowerCase());
      }
    }

    // 匹配全大写缩写（如 "API"、"GPT"、"LLM"）
    const acronyms = text.match(/\b[A-Z]{2,}\b/g);
    if (acronyms) {
      for (const a of acronyms) {
        entities.add(a.toLowerCase());
      }
    }

    // 增强中文实体提取：匹配中文专有名词模式
    // 模式1: "XX公司"、"XX系统"、"XX平台"、"XX模型" 等
    const chineseOrgSuffixes = text.match(/[\u4e00-\u9fa5]{2,}(?:公司|系统|平台|模型|机构|组织|部门|团队|产品|服务|项目|协议|标准|框架|引擎)/g);
    if (chineseOrgSuffixes) {
      for (const e of chineseOrgSuffixes) {
        entities.add(e.toLowerCase());
      }
    }

    // 模式2: 中文专有名词（连续中文字符≥3，排除常见词）
    const chinesePhrases = text.match(/[\u4e00-\u9fa5]{3,}/g);
    if (chinesePhrases) {
      const commonWords = new Set(['如果', '因为', '所以', '但是', '而且', '或者', '不是', '可以', '应该', '需要', '可能', '已经', '正在', '没有', '什么', '怎么', '为什么', '怎么样']);
      for (const p of chinesePhrases) {
        if (!commonWords.has(p)) {
          entities.add(p.toLowerCase());
        }
      }
    }

    // 模式3: 中文人名（姓+名，2-4字）
    const chineseNames = text.match(/[\u4e00-\u9fa5](?:[\u4e00-\u9fa5]{1,3})(?:先生|女士|教授|博士|经理|总监|主任|院长|主席|总|工)/g);
    if (chineseNames) {
      for (const n of chineseNames) {
        entities.add(n.toLowerCase());
      }
    }

    return entities;
  }
}

// ─────────────────────────────────────────────
// 贝叶斯评分器
// ─────────────────────────────────────────────

/**
 * 加权贝叶斯评分器
 * 
 * 使用 Beta 分布为每个指标建模，引入先验知识平滑小样本偏差。
 * 
 * @example
 * ```typescript
 * const scorer = new BayesianScorer();
 * 
 * // 记录结果
 * scorer.record('security.prompt_injection', true);
 * scorer.record('security.prompt_injection', true);
 * scorer.record('security.prompt_injection', false);
 * 
 * // 获取评分
 * const score = scorer.score('security.prompt_injection');
 * console.log(score.score); // 0.66 (而不是简单的 2/3=0.667)
 * console.log(score.confidence); // 置信度
 * ```
 */
export class BayesianScorer {
  private priorAlpha: number;
  private priorBeta: number;
  private confidenceThreshold: number;
  private hallucinationDetector: HallucinationDetector;

  /** 指标记录: name → { successes, total } */
  private records: Map<string, { successes: number; total: number }> = new Map();

  constructor(config?: BayesianScorerConfig) {
    this.priorAlpha = config?.priorAlpha ?? 2.0;
    this.priorBeta = config?.priorBeta ?? 2.0;
    this.confidenceThreshold = config?.confidenceThreshold ?? 0.3;
    this.hallucinationDetector = new HallucinationDetector(config?.hallucinationConfig);
  }

  /**
   * 记录一次评测结果
   * @param metric 指标名称（支持点分层级，如 "security.prompt_injection"）
   * @param success 是否成功
   */
  record(metric: string, success: boolean): void {
    let record = this.records.get(metric);
    if (!record) {
      record = { successes: 0, total: 0 };
      this.records.set(metric, record);
    }
    record.total++;
    if (success) record.successes++;
  }

  /**
   * 批量记录
   * @param metric 指标名称
   * @param results 成功/失败数组
   */
  recordBatch(metric: string, results: boolean[]): void {
    for (const r of results) {
      this.record(metric, r);
    }
  }

  /**
   * 获取单个指标的贝叶斯评分
   * @param metric 指标名称
   * @returns 评分结果
   */
  score(metric: string): MetricScore {
    const record = this.records.get(metric) ?? { successes: 0, total: 0 };
    return this._computeScore(metric, record.successes, record.total);
  }

  /**
   * 获取所有指标的评分
   */
  scoreAll(): Map<string, MetricScore> {
    const results = new Map<string, MetricScore>();
    for (const [name, record] of this.records) {
      results.set(name, this._computeScore(name, record.successes, record.total));
    }
    return results;
  }

  /**
   * 按维度聚合评分
   * @param dimensionMap 维度到指标名的映射（如 { security: ['security.a', 'security.b'] }）
   * @returns 各维度评分
   */
  scoreByDimension(dimensionMap: Record<string, string[]>): DimensionScore[] {
    const dimensions: DimensionScore[] = [];

    for (const [dimName, metrics] of Object.entries(dimensionMap)) {
      const metricScores: MetricScore[] = [];
      let totalScore = 0;
      let totalConfidence = 0;

      for (const metric of metrics) {
        const ms = this.score(metric);
        metricScores.push(ms);
        totalScore += ms.score;
        totalConfidence += ms.confidence;
      }

      const avgScore = metrics.length > 0 ? totalScore / metrics.length : 0;
      const avgConfidence = metrics.length > 0 ? totalConfidence / metrics.length : 0;

      let grade: DimensionScore['grade'];
      const pct = avgScore * 100;
      if (pct >= 95) grade = 'S';
      else if (pct >= 85) grade = 'A';
      else if (pct >= 70) grade = 'B';
      else if (pct >= 50) grade = 'C';
      else grade = 'D';

      dimensions.push({
        name: dimName,
        score: Math.round(avgScore * 10000) / 100,
        confidence: Math.round(avgConfidence * 10000) / 100,
        metrics: metricScores,
        grade,
      });
    }

    return dimensions;
  }

  /**
   * 幻觉检测
   * @param output Agent 输出
   * @param input 原始输入
   * @returns 检测结果
   */
  detectHallucination(output: string, input?: string): HallucinationResult[] {
    return this.hallucinationDetector.detect(output, input);
  }

  /**
   * 生成能力雷达数据
   * @param dimensionMap 维度映射
   * @returns 雷达数据
   */
  generateRadarData(dimensionMap: Record<string, string[]>): RadarData {
    const dims = this.scoreByDimension(dimensionMap);
    return {
      dimensions: dims.map(d => d.name),
      scores: dims.map(d => d.score),
      confidences: dims.map(d => d.confidence),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 重置所有记录
   */
  reset(): void {
    this.records.clear();
  }

  /**
   * 导出记录数据
   */
  export(): Record<string, { successes: number; total: number }> {
    const result: Record<string, { successes: number; total: number }> = {};
    for (const [name, record] of this.records) {
      result[name] = { ...record };
    }
    return result;
  }

  /**
   * 导入记录数据
   */
  import(data: Record<string, { successes: number; total: number }>): void {
    for (const [name, record] of Object.entries(data)) {
      this.records.set(name, { ...record });
    }
  }

  // ─── 私有方法 ───

  /**
   * 计算贝叶斯评分
   *
   * Beta 分布后验：
   *   alpha_post = prior_alpha + successes
   *   beta_post  = prior_beta + failures
   *   均值 = alpha_post / (alpha_post + beta_post)
   *   方差 = (alpha_post × beta_post) / ((alpha_post + beta_post)² × (alpha_post + beta_post + 1))
   *
   * 置信度基于变异系数（CV = stddev / mean）：
   *   CV 越小表示估计越精确，置信度越高。
   *   confidence = max(0, 1 - CV × SCALE)
   *   其中 SCALE = 2.0，使得 CV=0.5 时代入得 confidence=0。
   *
   * 这比之前 `1 - variance * 4` 的公式更稳健，
   * 因为变异系数是无量纲的相对度量，不受分数量级影响。
   */
  private _computeScore(name: string, successes: number, total: number): MetricScore {
    const failures = total - successes;
    const posteriorAlpha = this.priorAlpha + successes;
    const posteriorBeta = this.priorBeta + failures;

    // 后验均值
    const score = posteriorAlpha / (posteriorAlpha + posteriorBeta);

    // 后验方差
    const ab = posteriorAlpha + posteriorBeta;
    const variance = (posteriorAlpha * posteriorBeta) / (ab * ab * (ab + 1));

    // 基于变异系数（CV）的置信度：CV = stddev / mean
    // 比纯方差更稳健，因为它是无量纲的相对度量
    // [P0 FIX] 当 score <= 0 时避免除零，直接返回最低置信度
    const CV_SCALE_FACTOR = 2.0;
    const stddev = Math.sqrt(variance);
    let confidence: number;
    if (score <= 0) {
      confidence = 0;
    } else {
      const cv = stddev / score;
      confidence = Math.max(0, Math.min(1, 1 - cv * CV_SCALE_FACTOR));
    }

    return {
      name,
      score: Math.round(score * 10000) / 10000,
      confidence: Math.round(confidence * 10000) / 10000,
      successes,
      total,
      posteriorAlpha: Math.round(posteriorAlpha * 100) / 100,
      posteriorBeta: Math.round(posteriorBeta * 100) / 100,
    };
  }
}

// ─────────────────────────────────────────────
// [P1 IMPLEMENTATION] 百分位基准对标 + 能力趋势追踪
// ─────────────────────────────────────────────

/** 百分位基准 */
export interface PercentileBenchmark {
  /** 维度名称 */
  dimension: string;
  /** P50 中位数 */
  p50: number;
  /** P75 */
  p75: number;
  /** P90 */
  p90: number;
  /** P95 */
  p95: number;
  /** 样本数 */
  sampleSize: number;
  /** 更新时间 */
  updatedAt: string;
}

/** 趋势数据点 */
export interface TrendPoint {
  /** 评测序号 */
  sequence: number;
  /** 时间 */
  timestamp: string;
  /** 得分 */
  score: number;
  /** 移动平均 */
  movingAvg: number;
  /** 环比变化（百分比） */
  changePct: number;
}

/** 能力趋势 */
export interface DimensionTrend {
  /** 维度名称 */
  dimension: string;
  /** 历史数据点 */
  points: TrendPoint[];
  /** 当前移动平均 */
  currentMovingAvg: number;
  /** 趋势方向 */
  direction: 'improving' | 'declining' | 'stable';
  /** 是否有退化预警 */
  hasRegression: boolean;
  /** 退化详情 */
  regressionDetail?: string;
}

/** 趋势追踪配置 */
export interface TrendTrackerConfig {
  /** 移动平均窗口大小，默认 5 */
  windowSize?: number;
  /** 退化预警阈值（百分比），默认 5 */
  regressionThreshold?: number;
}

/**
 * 百分位基准对标器
 * 
 * 维护各维度的历史评分分布，提供百分位计算。
 */
export class PercentileBenchmarking {
  /** 维度 → 历史分数列表 */
  private history: Map<string, number[]> = new Map();

  /**
   * 添加评分数据
   * @param dimension 维度名称
   * @param score 分数（0-100）
   */
  addScore(dimension: string, score: number): void {
    let scores = this.history.get(dimension);
    if (!scores) {
      scores = [];
      this.history.set(dimension, scores);
    }
    scores.push(score);
  }

  /**
   * 批量添加评分
   */
  addScores(scores: Array<{ dimension: string; score: number }>): void {
    for (const s of scores) {
      this.addScore(s.dimension, s.score);
    }
  }

  /**
   * 计算指定维度的百分位基准
   * @param dimension 维度名称
   * @returns 百分位基准
   */
  getBenchmark(dimension: string): PercentileBenchmark | null {
    const scores = this.history.get(dimension);
    if (!scores || scores.length === 0) return null;

    const sorted = [...scores].sort((a, b) => a - b);

    return {
      dimension,
      p50: PercentileBenchmarking._percentile(sorted, 50),
      p75: PercentileBenchmarking._percentile(sorted, 75),
      p90: PercentileBenchmarking._percentile(sorted, 90),
      p95: PercentileBenchmarking._percentile(sorted, 95),
      sampleSize: sorted.length,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 获取所有维度的百分位基准
   */
  getAllBenchmarks(): PercentileBenchmark[] {
    const results: PercentileBenchmark[] = [];
    for (const dim of this.history.keys()) {
      const bm = this.getBenchmark(dim);
      if (bm) results.push(bm);
    }
    return results;
  }

  /**
   * 将分数转换为百分位位置
   * @param dimension 维度
   * @param score 分数
   * @returns 百分位位置（0-100）
   */
  scoreToPercentile(dimension: string, score: number): number {
    const scores = this.history.get(dimension);
    if (!scores || scores.length === 0) return 50; // 默认 P50

    const sorted = [...scores].sort((a, b) => a - b);
    let count = 0;
    for (const s of sorted) {
      if (s < score) count++;
      else if (s === score) count += 0.5;
    }
    return Math.round((count / sorted.length) * 100);
  }

  /**
   * 计算百分位（线性插值）
   */
  private static _percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];

    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return Math.round(sorted[lower] * 100) / 100;
    }

    const fraction = index - lower;
    const result = sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
    return Math.round(result * 100) / 100;
  }
}

/**
 * 能力趋势追踪器
 * 
 * 追踪各维度评分的移动平均、环比变化，
 * 并在 >5% 波动时自动标记退化预警。
 * 
 * @example
 * ```typescript
 * const tracker = new TrendTracker({ windowSize: 5, regressionThreshold: 5 });
 * 
 * // 记录评测
 * tracker.record(1, 'security', 85);
 * tracker.record(2, 'security', 82);
 * tracker.record(3, 'security', 78);
 * 
 * // 获取趋势
 * const trend = tracker.getTrend('security');
 * console.log(trend.direction); // 'declining'
 * console.log(trend.hasRegression); // true
 * ```
 */
export class TrendTracker {
  private windowSize: number;
  private regressionThreshold: number;
  /** 维度 → { sequence → score } */
  private data: Map<string, Map<number, { score: number; timestamp: string }>> = new Map();

  constructor(config?: TrendTrackerConfig) {
    this.windowSize = config?.windowSize ?? 5;
    this.regressionThreshold = config?.regressionThreshold ?? 5;
  }

  /**
   * 记录一次评测分数
   * @param sequence 评测序号
   * @param dimension 维度名称
   * @param score 分数（0-100）
   * @param timestamp 时间戳（可选）
   */
  record(sequence: number, dimension: string, score: number, timestamp?: string): void {
    let dimData = this.data.get(dimension);
    if (!dimData) {
      dimData = new Map();
      this.data.set(dimension, dimData);
    }
    dimData.set(sequence, {
      score,
      timestamp: timestamp ?? new Date().toISOString(),
    });
  }

  /**
   * 获取指定维度的趋势
   * @param dimension 维度名称
   * @returns 能力趋势
   */
  getTrend(dimension: string): DimensionTrend | null {
    const dimData = this.data.get(dimension);
    if (!dimData || dimData.size === 0) return null;

    // 按序号排序
    const sorted = Array.from(dimData.entries()).sort((a, b) => a[0] - b[0]);

    // 计算趋势数据点
    const points: TrendPoint[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const [seq, { score, timestamp }] = sorted[i];

      // 移动平均
      const windowStart = Math.max(0, i - this.windowSize + 1);
      const window = sorted.slice(windowStart, i + 1).map(([, d]) => d.score);
      const movingAvg = window.reduce((a, b) => a + b, 0) / window.length;

      // 环比变化
      const changePct = i > 0
        ? ((score - sorted[i - 1][1].score) / Math.max(sorted[i - 1][1].score, 1)) * 100
        : 0;

      points.push({
        sequence: seq,
        timestamp,
        score,
        movingAvg: Math.round(movingAvg * 100) / 100,
        changePct: Math.round(changePct * 100) / 100,
      });
    }

    // 当前移动平均
    const currentMovingAvg = points.length > 0 ? points[points.length - 1].movingAvg : 0;

    // 趋势方向（基于最近 3 个点的移动平均）
    let direction: DimensionTrend['direction'] = 'stable';
    if (points.length >= 3) {
      const recent = points.slice(-3);
      const avgChange = recent.reduce((sum, p) => sum + p.changePct, 0) / recent.length;
      if (avgChange > 2) direction = 'improving';
      else if (avgChange < -2) direction = 'declining';
    }

    // 退化预警
    let hasRegression = false;
    let regressionDetail: string | undefined;

    for (const p of points) {
      if (Math.abs(p.changePct) > this.regressionThreshold) {
        hasRegression = true;
        regressionDetail = `序号 ${p.sequence}: 环比变化 ${p.changePct > 0 ? '+' : ''}${p.changePct.toFixed(1)}%（阈值 ±${this.regressionThreshold}%）`;
        break; // 标记第一次预警
      }
    }

    return {
      dimension,
      points,
      currentMovingAvg,
      direction,
      hasRegression,
      regressionDetail,
    };
  }

  /**
   * 获取所有维度的趋势
   */
  getAllTrends(): DimensionTrend[] {
    const results: DimensionTrend[] = [];
    for (const dim of this.data.keys()) {
      const trend = this.getTrend(dim);
      if (trend) results.push(trend);
    }
    return results;
  }

  /**
   * 获取退化预警列表
   */
  getRegressions(): Array<{ dimension: string; detail: string }> {
    const regressions: Array<{ dimension: string; detail: string }> = [];
    for (const dim of this.data.keys()) {
      const trend = this.getTrend(dim);
      if (trend?.hasRegression && trend.regressionDetail) {
        regressions.push({ dimension: dim, detail: trend.regressionDetail });
      }
    }
    return regressions;
  }

  /**
   * 清除指定维度的数据
   */
  clear(dimension?: string): void {
    if (dimension) {
      this.data.delete(dimension);
    } else {
      this.data.clear();
    }
  }
}

// ─────────────────────────────────────────────
// 便利函数
// ─────────────────────────────────────────────

/**
 * 快速计算贝叶斯评分（无状态）
 * @param successes 成功次数
 * @param total 总次数
 * @param priorAlpha 先验 alpha
 * @param priorBeta 先验 beta
 * @returns 后验均值（0-1）
 */
export function bayesianMean(
  successes: number,
  total: number,
  priorAlpha = 2.0,
  priorBeta = 2.0,
): number {
  const alpha = priorAlpha + successes;
  const beta = priorBeta + (total - successes);
  return alpha / (alpha + beta);
}
