/**
 * 🪞 MirrorAI — 狄利克雷分布行为建模模块 (DirichletModel)
 * 
 * 核心功能：
 * - 工具调用转移矩阵构建
 * - 狄利克雷分布拟合与异常检测
 * - 马氏距离计算
 * - 在线学习更新
 */

// ─────────────────────────────────────────────
// 1. 类型定义
// ─────────────────────────────────────────────

/** 工具调用序列 */
export interface ToolCallSequence {
  /** 工具调用名称列表 */
  tools: string[];
  /** 可选时间戳 */
  timestamps?: number[];
}

/** 行为分析结果 */
export interface BehaviorAnalysis {
  /** 是否正常行为 */
  normal: boolean;
  /** 与基线的马氏距离 */
  mahalanobisDistance: number;
  /** 风险等级 */
  riskLevel: 'safe' | 'warning' | 'alert' | 'critical';
  /** 偏离正常的工具列表 */
  deviantTools: string[];
  /** 行为指纹（转移概率向量） */
  fingerprint: number[];
}

/** 狄利克雷模型配置 */
export interface DirichletConfig {
  /** 先验 α 参数（默认 1.0，拉普拉斯平滑） */
  priorAlpha: number;
  /** 马氏距离异常阈值（默认 3.0） */
  anomalyThreshold: number;
  /** 最少训练样本数（默认 10） */
  minSamples: number;
  /** 是否启用在线学习（默认 true） */
  onlineLearning: boolean;
}

/** 模型快照（用于导出/导入） */
export interface ModelSnapshot {
  /** 工具列表 */
  tools: string[];
  /** 狄利克雷 α 参数矩阵（扁平化） */
  alphaMatrix: number[];
  /** 转移计数矩阵（扁平化） */
  countMatrix: number[];
  /** 训练样本数 */
  sampleCount: number;
  /** 基线均值 */
  mean: number[];
  /** 协方差矩阵的逆（扁平化） */
  sigmaInv: number[];
  /** 行为指纹数组 */
  fingerprints?: number[][];
}

// ─────────────────────────────────────────────
// 2. 工具调用转移矩阵
// ─────────────────────────────────────────────

/**
 * 工具调用转移矩阵
 * 
 * 记录工具 A → 工具 B 的转移次数，
 * 用于刻画 Agent 的行为模式。
 */
export class ToolTransitionMatrix {
  private tools: string[];
  private toolIndex: Map<string, number>;
  private counts: number[][];
  private totalCounts: number[];

  /**
   * @param tools 工具名称列表
   */
  constructor(tools: string[]) {
    this.tools = [...tools];
    this.toolIndex = new Map(tools.map((t, i) => [t, i]));
    const n = tools.length;
    // 初始化计数矩阵（含 START 状态 +1 行）
    this.counts = Array.from({ length: n }, () => new Array(n).fill(0));
    this.totalCounts = new Array(n).fill(0);
  }

  /**
   * 记录一次工具转移
   * @param from 来源工具名
   * @param to 目标工具名
   */
  record(from: string, to: string): void {
    const fromIdx = this.toolIndex.get(from);
    const toIdx = this.toolIndex.get(to);
    if (fromIdx !== undefined && toIdx !== undefined) {
      this.counts[fromIdx][toIdx]++;
      this.totalCounts[fromIdx]++;
    }
  }

  /**
   * 获取归一化概率矩阵
   * @returns 概率矩阵 P[i][j] = P(工具j | 工具i)
   */
  getProbabilities(): number[][] {
    const n = this.tools.length;
    return this.counts.map((row, i) => {
      const total = this.totalCounts[i];
      if (total === 0) return new Array(n).fill(1 / n); // 均匀先验
      return row.map(count => count / total);
    });
  }

  /** 获取工具列表 */
  getTools(): string[] {
    return [...this.tools];
  }

  /** 获取原始计数矩阵 */
  getCounts(): number[][] {
    return this.counts.map(row => [...row]);
  }

  /** 重置所有计数 */
  reset(): void {
    const n = this.tools.length;
    this.counts = Array.from({ length: n }, () => new Array(n).fill(0));
    this.totalCounts = new Array(n).fill(0);
  }
}

// ─────────────────────────────────────────────
// 3. 马氏距离计算
// ─────────────────────────────────────────────

/**
 * 计算马氏距离 (Mahalanobis Distance)
 * 
 * 马氏距离衡量一个点到分布中心的距离，
 * 考虑了数据的协方差结构。
 * 
 * D = sqrt((x - μ)^T × Σ^{-1} × (x - μ))
 * 
 * @param x 新行为指纹向量
 * @param mu 基线均值向量
 * @param sigmaInv 协方差矩阵的逆
 * @returns 马氏距离
 */
export function mahalanobisDistance(
  x: number[],
  mu: number[],
  sigmaInv: number[][],
): number {
  const n = x.length;

  // 差值向量 d = x - μ
  const d: number[] = [];
  for (let i = 0; i < n; i++) {
    d.push(x[i] - mu[i]);
  }

  // 计算 D² = d^T × Σ^{-1} × d
  let distSq = 0;
  for (let i = 0; i < n; i++) {
    let rowSum = 0;
    for (let j = 0; j < n; j++) {
      rowSum += sigmaInv[i][j] * d[j];
    }
    distSq += d[i] * rowSum;
  }

  // 防止数值精度问题导致负值
  return Math.sqrt(Math.max(0, distSq));
}

// ─────────────────────────────────────────────
// 4. 辅助函数
// ─────────────────────────────────────────────

/**
 * 将工具序列转换为转移概率指纹
 * 
 * 给定一个工具调用序列，计算其转移频率分布，
 * 作为该序列的"行为指纹"。
 * 
 * @param tools 工具名称列表
 * @param allTools 全部工具名称列表（用于对齐维度）
 * @returns 归一化的转移频率向量
 */
function sequenceToFingerprint(tools: string[], allTools: string[]): number[] {
  const n = allTools.length;
  const toolIndex = new Map(allTools.map((t, i) => [t, i]));
  const counts = new Array(n * n).fill(0);

  // 统计转移次数
  for (let i = 0; i < tools.length - 1; i++) {
    const fromIdx = toolIndex.get(tools[i]);
    const toIdx = toolIndex.get(tools[i + 1]);
    if (fromIdx !== undefined && toIdx !== undefined) {
      counts[fromIdx * n + toIdx]++;
    }
  }

  // 归一化为概率
  const total = counts.reduce((s, c) => s + c, 0);
  if (total === 0) return new Array(n * n).fill(1 / (n * n)); // 均匀分布
  return counts.map(c => c / total);
}

/**
 * 计算矩阵的逆（高斯-约当消元）
 * 支持正则化以防止奇异矩阵
 */
function invertMatrixReg(matrix: number[][], regLambda: number = 1e-6): number[][] {
  const n = matrix.length;
  // 增广矩阵 [A + λI | I]
  const aug: number[][] = matrix.map((row, i) => {
    const identity = new Array(n).fill(0);
    identity[i] = 1;
    return [...row.map((v, j) => v + (i === j ? regLambda : 0)), ...identity];
  });

  for (let col = 0; col < n; col++) {
    // 部分主元
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-15) continue;

    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  return aug.map(row => row.slice(n));
}

/**
 * 计算两个向量的协方差矩阵
 */
function computeCovariance(fingerprints: number[][]): number[][] {
  const n = fingerprints.length;
  if (n < 2) return [];

  const dim = fingerprints[0].length;

  // 当样本数小于维度时，协方差矩阵奇异，返回单位矩阵
  if (n < dim) {
    return Array.from({ length: dim }, (_, i) =>
      Array.from({ length: dim }, (_, j) => i === j ? 1 : 0)
    );
  }

  // 计算均值
  const mean = new Array(dim).fill(0);
  for (const fp of fingerprints) {
    for (let j = 0; j < dim; j++) mean[j] += fp[j];
  }
  for (let j = 0; j < dim; j++) mean[j] /= n;

  // 计算协方差
  const cov: number[][] = Array.from({ length: dim }, () => new Array(dim).fill(0));
  for (const fp of fingerprints) {
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        cov[i][j] += (fp[i] - mean[i]) * (fp[j] - mean[j]);
      }
    }
  }
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      cov[i][j] /= (n - 1);
    }
  }

  return cov;
}

/**
 * 根据马氏距离确定风险等级
 */
function distanceToRiskLevel(distance: number, threshold: number): 'safe' | 'warning' | 'alert' | 'critical' {
  if (distance < threshold * 0.5) return 'safe';
  if (distance < threshold) return 'warning';
  if (distance < threshold * 2) return 'alert';
  return 'critical';
}

// ─────────────────────────────────────────────
// 5. 狄利克雷分布模型
// ─────────────────────────────────────────────

/** 默认配置 */
const DEFAULT_CONFIG: DirichletConfig = {
  priorAlpha: 1.0,
  anomalyThreshold: 3.0,
  minSamples: 10,
  onlineLearning: true,
};

/**
 * 狄利克雷分布行为建模
 * 
 * 使用狄利克雷分布对 Agent 的工具调用行为进行建模：
 * 1. 从历史序列拟合分布参数（α）
 * 2. 将行为序列编码为转移概率指纹
 * 3. 使用马氏距离检测异常行为
 * 4. 支持在线学习持续更新模型
 * 
 * @example
 * ```typescript
 * const model = new DirichletModel(['search', 'calculate', 'write']);
 * 
 * // 训练
 * model.train([
 *   { tools: ['search', 'calculate', 'write'] },
 *   { tools: ['search', 'write', 'calculate'] },
 * ]);
 * 
 * // 检测
 * const analysis = model.detect({ tools: ['search', 'hack', 'exploit'] });
 * if (!analysis.normal) {
 *   console.warn('异常行为！', analysis.riskLevel);
 * }
 * ```
 */
export class DirichletModel {
  private tools: string[];
  private config: DirichletConfig;
  private toolIndex: Map<string, number>;

  // 狄利克雷 α 参数（转移计数 + 先验）
  private alphaCounts: number[][];
  private sampleCount: number = 0;

  // 基线统计
  private fingerprints: number[][] = [];
  private mean: number[] = [];
  private sigmaInv: number[][] = [];

  /**
   * @param tools 工具名称列表
   * @param config 配置选项
   */
  constructor(tools: string[], config?: Partial<DirichletConfig>) {
    this.tools = [...tools];
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.toolIndex = new Map(tools.map((t, i) => [t, i]));

    const n = tools.length;
    // 初始化 α 计数矩阵（含先验平滑）
    this.alphaCounts = Array.from(
      { length: n },
      () => new Array(n).fill(this.config.priorAlpha)
    );
  }

  /**
   * 从历史数据训练模型
   * 
   * 1. 构建转移计数矩阵
   * 2. 收集行为指纹
   * 3. 计算基线均值和协方差矩阵逆
   * 
   * @param sequences 历史工具调用序列
   */
  train(sequences: ToolCallSequence[]): void {
    if (sequences.length === 0) return;

    // 1. 收集所有指纹
    this.fingerprints = [];

    for (const seq of sequences) {
      // 更新转移计数
      this._updateCounts(seq.tools);
      // 生成指纹
      const fp = sequenceToFingerprint(seq.tools, this.tools);
      this.fingerprints.push(fp);
    }

    this.sampleCount = sequences.length;

    // 2. 计算基线统计
    this._computeBaseline();
  }

  /**
   * 检测单个行为序列
   * 
   * @param sequence 待检测的工具调用序列
   * @returns 行为分析结果
   */
  detect(sequence: ToolCallSequence): BehaviorAnalysis {
    const fingerprint = sequenceToFingerprint(sequence.tools, this.tools);

    // 检查是否已训练
    if (this.sampleCount < this.config.minSamples || this.mean.length === 0) {
      return {
        normal: true,
        mahalanobisDistance: 0,
        riskLevel: 'safe',
        deviantTools: [],
        fingerprint,
      };
    }

    // 计算马氏距离
    const distance = mahalanobisDistance(fingerprint, this.mean, this.sigmaInv);

    // 确定风险等级
    const riskLevel = distanceToRiskLevel(distance, this.config.anomalyThreshold);

    // 识别偏离工具
    const deviantTools = this._findDeviantTools(sequence.tools);

    return {
      normal: distance < this.config.anomalyThreshold,
      mahalanobisDistance: distance,
      riskLevel,
      deviantTools,
      fingerprint,
    };
  }

  /**
   * 在线学习更新
   * 
   * 用新观测到的行为序列更新模型参数，
   * 实现增量学习。
   * 
   * @param sequence 新观测到的工具调用序列
   */
  update(sequence: ToolCallSequence): void {
    if (!this.config.onlineLearning) return;

    // 更新转移计数
    this._updateCounts(sequence.tools);

    // 添加到指纹库
    const fp = sequenceToFingerprint(sequence.tools, this.tools);
    this.fingerprints.push(fp);
    this.sampleCount++;

    // 重新计算基线
    this._computeBaseline();
  }

  /**
   * 获取当前基线指纹
   * @returns 基线指纹向量
   */
  getFingerprint(): number[] {
    return [...this.mean];
  }

  /**
   * 导出模型快照
   * @returns 可序列化的模型状态
   */
  export(): ModelSnapshot {
    return {
      tools: [...this.tools],
      alphaMatrix: this.alphaCounts.flat(),
      countMatrix: this.alphaCounts.map(row =>
        row.map(v => v - this.config.priorAlpha)
      ).flat(),
      sampleCount: this.sampleCount,
      mean: [...this.mean],
      sigmaInv: this.sigmaInv.flat(),
      fingerprints: this.fingerprints.map(fp => [...fp]),
    };
  }

  /**
   * 从快照恢复模型
   * @param snapshot 模型快照
   */
  import(snapshot: ModelSnapshot): void {
    const n = snapshot.tools.length;
    this.tools = [...snapshot.tools];
    this.toolIndex = new Map(this.tools.map((t, i) => [t, i]));
    this.sampleCount = snapshot.sampleCount;
    this.mean = [...snapshot.mean];

    // 恢复 alpha 矩阵
    this.alphaCounts = [];
    for (let i = 0; i < n; i++) {
      this.alphaCounts.push(snapshot.alphaMatrix.slice(i * n, (i + 1) * n));
    }

    // 恢复协方差逆矩阵
    this.sigmaInv = [];
    for (let i = 0; i < n * n; i += n) {
      this.sigmaInv.push(snapshot.sigmaInv.slice(i, i + n));
    }

    // 恢复行为指纹
    if (snapshot.fingerprints) {
      this.fingerprints = snapshot.fingerprints.map(fp => [...fp]);
    }
  }

  // ─────────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────────

  /** 更新转移计数矩阵 */
  private _updateCounts(tools: string[]): void {
    for (let i = 0; i < tools.length - 1; i++) {
      const fromIdx = this.toolIndex.get(tools[i]);
      const toIdx = this.toolIndex.get(tools[i + 1]);
      if (fromIdx !== undefined && toIdx !== undefined) {
        this.alphaCounts[fromIdx][toIdx]++;
      }
    }
  }

  /** 计算基线均值和协方差逆矩阵 */
  private _computeBaseline(): void {
    if (this.fingerprints.length < 2) {
      // 样本太少，使用转移概率矩阵的期望值作为均值
      const probs = this.alphaCounts.map(row => {
        const sum = row.reduce((s, v) => s + v, 0);
        return row.map(v => v / sum);
      });
      this.mean = probs.flat();
      // 单位矩阵作为协方差逆
      const n = this.tools.length;
      const dim = n * n;
      this.sigmaInv = Array.from({ length: dim }, (_, i) =>
        Array.from({ length: dim }, (_, j) => i === j ? 1 : 0)
      );
      return;
    }

    // 计算均值
    const dim = this.fingerprints[0].length;
    this.mean = new Array(dim).fill(0);
    for (const fp of this.fingerprints) {
      for (let j = 0; j < dim; j++) this.mean[j] += fp[j];
    }
    for (let j = 0; j < dim; j++) this.mean[j] /= this.fingerprints.length;

    // 计算协方差矩阵并求逆
    const cov = computeCovariance(this.fingerprints);
    if (cov.length > 0) {
      this.sigmaInv = invertMatrixReg(cov);
    }
  }

  /** 识别偏离正常的工具 */
  private _findDeviantTools(tools: string[]): string[] {
    if (this.alphaCounts.length === 0) return [];

    const deviant: string[] = [];
    for (const tool of tools) {
      const idx = this.toolIndex.get(tool);
      if (idx === undefined) {
        // 完全未知的工具
        deviant.push(tool);
      }
    }
    return deviant;
  }
}
