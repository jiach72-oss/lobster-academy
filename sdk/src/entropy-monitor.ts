/**
 * 🪞 MirrorAI — 熵动力学监控模块 (EntropyMonitor)
 * 
 * 核心功能：
 * - 香农熵计算（基于 logprobs）
 * - Savitzky-Golay 滤波器（信号平滑）
 * - 熵动力学三阶导数（速度/加速度/Jerk）
 * - 实时异常检测规则引擎
 * - 流式 + 批量分析模式
 */

// ─────────────────────────────────────────────
// 1. 类型定义
// ─────────────────────────────────────────────

/**
 * logprobs 条目 — OpenAI 风格的对数概率数据
 * LogProb entry from LLM API response
 */
export interface LogProbEntry {
  /** 生成的 token 文本 */
  token: string;
  /** 该 token 的对数概率 */
  logprob: number;
  /** top-N 候选 token 及其对数概率 */
  topLogprobs: { token: string; logprob: number }[];
}

/** 熵监控配置 */
export interface EntropyMonitorConfig {
  /** SG 滤波器窗口大小（奇数，默认 5） */
  windowSize: number;
  /** SG 多项式阶数（默认 2） */
  polyOrder: number;
  /** 加速度异常阈值（默认 0.15） */
  accelThreshold: number;
  /** Jerk 异常阈值（默认 0.25） */
  jerkThreshold: number;
  /** 熵突增阈值（默认 2.0） */
  entropySpike: number;
  /** 连续异常步数阈值（默认 3） */
  consecutiveSteps: number;
  /** 流式模式开关（默认 true） */
  streamingMode: boolean;
}

/** 单步监控结果 */
export interface MonitorResult {
  /** 当前步序号 */
  step: number;
  /** 原始香农熵 */
  entropy: number;
  /** 熵速度 (dH/dt) */
  velocity: number;
  /** 熵加速度 (d²H/dt²) */
  acceleration: number;
  /** 熵 Jerk (d³H/dt³) */
  jerk: number;
  /** 平滑后的速度 */
  smoothedVelocity: number;
  /** 平滑后的加速度 */
  smoothedAcceleration: number;
  /** 平滑后的 Jerk */
  smoothedJerk: number;
  /** 风险等级 */
  riskLevel: 'safe' | 'warning' | 'alert' | 'critical';
  /** 触发的规则名称列表 */
  triggeredRules: string[];
  /** 置信度 (0-1) */
  confidence: number;
}

/** 批量分析结果 */
export interface ChainAnalysisResult {
  /** 总步数 */
  totalSteps: number;
  /** 异常步数 */
  anomalySteps: number;
  /** 异常比例 (0-1) */
  anomalyRatio: number;
  /** 最高风险等级 */
  maxRiskLevel: string;
  /** 意图漂移评分 (0-100) */
  intentDriftScore: number;
  /** 时间线 */
  timeline: MonitorResult[];
}

/** 监控器当前状态 */
export interface MonitorStatus {
  /** 当前步序号 */
  currentStep: number;
  /** 当前熵值 */
  currentEntropy: number;
  /** 当前风险等级 */
  currentRisk: string;
  /** 已检测到的异常数 */
  anomaliesDetected: number;
}

// ─────────────────────────────────────────────
// 2. 香农熵计算
// ─────────────────────────────────────────────

/**
 * 从对数概率计算香农熵
 * H = -Σ p(i) × log₂(p(i))
 * 
 * 输入是 logprobs（自然对数概率），需要先 exp 转为概率再计算。
 * 
 * @param logprobs 对数概率数组（自然对数）
 * @returns 香农熵（单位：bits）
 */
export function shannonEntropy(logprobs: number[]): number {
  if (!logprobs || logprobs.length === 0) return 0;

  // Step 1: 对数概率 → 概率
  const probs = logprobs.map(lp => Math.exp(lp));

  // Step 2: 归一化（数值稳定性保障）
  const sum = probs.reduce((s, p) => s + p, 0);
  if (sum <= 0) return 0;
  const normalized = probs.map(p => p / sum);

  // Step 3: 香农熵 H = -Σ p(i) × log₂(p(i))
  let entropy = 0;
  for (const p of normalized) {
    if (p > 0) {
      // log₂(p) = ln(p) / ln(2)
      entropy -= p * (Math.log(p) / Math.log(2));
    }
  }

  return entropy;
}

// ─────────────────────────────────────────────
// 3. Savitzky-Golay 滤波器
// ─────────────────────────────────────────────

/**
 * 计算 SG 卷积系数
 * 使用 Vandermonde 矩阵法预计算系数
 * 
 * SG 滤波器通过对局部数据拟合多项式来实现平滑，
 * 等价于对原始数据施加卷积核。
 * 
 * @param halfWindowSize 半窗口大小 m（总窗口 = 2m+1）
 * @param polyOrder 多项式阶数
 * @param deriv 求导阶数（0=平滑，1=一阶导，2=二阶导...）
 * @returns 卷积系数数组（长度 = 2m+1）
 */
function sgCoefficients(halfWindowSize: number, polyOrder: number, deriv: number = 0): number[] {
  const n = 2 * halfWindowSize + 1;
  const k = polyOrder + 1;

  // 构建 Vandermonde 矩阵 J: J[i][j] = i^j，其中 i ∈ [-m, m]
  // Build Vandermonde matrix
  const J: number[][] = [];
  for (let i = -halfWindowSize; i <= halfWindowSize; i++) {
    const row: number[] = [];
    for (let j = 0; j < k; j++) {
      row.push(Math.pow(i, j));
    }
    J.push(row);
  }

  // 计算 J^T × J
  const JtJ: number[][] = [];
  for (let i = 0; i < k; i++) {
    const row: number[] = [];
    for (let j = 0; j < k; j++) {
      let sum = 0;
      for (let r = 0; r < n; r++) {
        sum += J[r][i] * J[r][j];
      }
      row.push(sum);
    }
    JtJ.push(row);
  }

  // 高斯消元求 (J^T J)^{-1}
  const inv = invertMatrix(JtJ);

  // 卷积系数 = deriv! × (J^T J)^{-1} × J^T 的第 deriv 行
  const factorial = (x: number): number => { let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; };
  const coeffs: number[] = [];
  for (let col = 0; col < n; col++) {
    let sum = 0;
    for (let j = 0; j < k; j++) {
      sum += inv[deriv][j] * J[col][j];
    }
    coeffs.push(sum * factorial(deriv));
  }

  return coeffs;
}

/**
 * 高斯消元求矩阵逆
 * Gaussian elimination with partial pivoting
 */
function invertMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  // 增广矩阵 [A | I]
  const aug: number[][] = matrix.map((row, i) => {
    const identity = new Array(n).fill(0);
    identity[i] = 1;
    return [...row, ...identity];
  });

  for (let col = 0; col < n; col++) {
    // 部分主元选取
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue; // 奇异矩阵防护

    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // 提取逆矩阵
  return aug.map(row => row.slice(n));
}

/**
 * 镜像填充边界处理
 * Mirror padding for boundary handling
 */
function mirrorPad(data: number[], padSize: number): number[] {
  const result: number[] = [];
  // 左侧镜像
  for (let i = padSize - 1; i >= 0; i--) {
    result.push(data[Math.min(i, data.length - 1)]);
  }
  // 原始数据
  result.push(...data);
  // 右侧镜像
  for (let i = 0; i < padSize; i++) {
    result.push(data[Math.max(0, data.length - 1 - i)]);
  }
  return result;
}

/**
 * Savitzky-Golay 滤波器
 * 
 * 对时间序列数据进行多项式拟合平滑，
 * 能在去除噪声的同时保留信号的高阶特征。
 * 
 * @param data 原始数据数组
 * @param windowSize 窗口大小（奇数）
 * @param polyOrder 多项式阶数
 * @returns 平滑后的数据数组（与输入等长）
 */
export function savitzkyGolay(data: number[], windowSize: number, polyOrder: number): number[] {
  if (!data || data.length === 0) return [];
  if (windowSize < 3) return [...data]; // 窗口太小直接返回
  if (windowSize % 2 === 0) windowSize += 1; // 确保奇数

  const halfWindow = Math.floor(windowSize / 2);
  if (data.length <= halfWindow) return [...data]; // 数据太短直接返回

  // 预计算平滑系数（deriv=0）
  const coeffs = sgCoefficients(halfWindow, polyOrder, 0);

  // 镜像填充
  const padded = mirrorPad(data, halfWindow);

  // 卷积运算
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < coeffs.length; j++) {
      sum += coeffs[j] * padded[i + j];
    }
    result.push(sum);
  }

  return result;
}

// ─────────────────────────────────────────────
// 4. 熵动力学类（三阶导数）
// ─────────────────────────────────────────────

/**
 * 熵动力学 — 追踪熵的高阶时间导数
 * 
 * 通过维护滑动窗口历史，实时计算：
 * - 速度 v = dH/dt（一阶导数）
 * - 加速度 a = d²H/dt²（二阶导数）
 * - Jerk j = d³H/dt³（三阶导数）
 * 
 * 使用有限差分近似。
 */
export class EntropyDynamics {
  private history: number[] = [];

  /**
   * 推入新的熵值，计算高阶导数
   * @param entropy 当前步的香农熵
   * @returns 速度、加速度、Jerk
   */
  push(entropy: number): { v: number; a: number; j: number } {
    this.history.push(entropy);

    const len = this.history.length;

    // 速度 v = dH/dt（一阶前向差分）
    const v = len >= 2 ? this.history[len - 1] - this.history[len - 2] : 0;

    // 加速度 a = dv/dt（二阶差分）
    // 使用三点中心差分提高精度
    let a = 0;
    if (len >= 3) {
      const vPrev = this.history[len - 2] - this.history[len - 3];
      const vCurr = this.history[len - 1] - this.history[len - 2];
      a = vCurr - vPrev;
    }

    // Jerk j = da/dt（三阶差分）
    let j = 0;
    if (len >= 4) {
      const v1 = this.history[len - 2] - this.history[len - 3];
      const v2 = this.history[len - 1] - this.history[len - 2];
      const aCurr = v2 - v1;
      const v0 = this.history[len - 3] - this.history[len - 4];
      const aPrev = v1 - v0;
      j = aCurr - aPrev;
    }

    return { v, a, j };
  }

  /** 获取历史长度 */
  get length(): number {
    return this.history.length;
  }

  /** 获取历史数据（拷贝） */
  getHistory(): number[] {
    return [...this.history];
  }

  /** 重置 */
  reset(): void {
    this.history = [];
  }
}

// ─────────────────────────────────────────────
// 5. 异常检测规则
// ─────────────────────────────────────────────

/**
 * 异常检测规则引擎
 * 每条规则返回布尔值，表示是否触发异常
 */
const RULES = {
  /**
   * Rule 1: 加速度持续偏高 (Acceleration Drift)
   * 当连续 N 步的加速度都超过阈值时触发，
   * 表示模型在持续偏离正常推理路径。
   */
  ACCEL_DRIFT: (a: number[], threshold: number, consecutive: number): boolean =>
    a.length >= consecutive && a.slice(-consecutive).every(v => Math.abs(v) > threshold),

  /**
   * Rule 2: Jerk 符号反转 (Jerk Reversal)
   * Jerk 的符号突变表示推理方向突然改变，
   * 可能是 prompt injection 或 hallucination 信号。
   */
  JERK_REVERSAL: (j: number[], threshold: number): boolean =>
    j.length >= 2 &&
    Math.abs(j[j.length - 1] - j[j.length - 2]) > threshold &&
    Math.sign(j[j.length - 1]) !== Math.sign(j[j.length - 2]) &&
    j[j.length - 1] !== 0 &&
    j[j.length - 2] !== 0,

  /**
   * Rule 3: 熵突增 (Entropy Spike)
   * 单步熵增量超过阈值，表示模型突然变得非常不确定，
   * 可能是遇到 OOD 输入或被攻击。
   */
  ENTROPY_SPIKE: (h: number, hPrev: number, maxDelta: number): boolean =>
    h - hPrev > maxDelta,

  /**
   * Rule 4: 持续正增长 (Sustained Growth)
   * 速度持续为正表示熵在不断增大，
   * 模型确信度持续下降，需要预警。
   */
  SUSTAINED_GROWTH: (v: number[], steps: number): boolean =>
    v.length >= steps && v.slice(-steps).every(x => x > 0),
} as const;

// ─────────────────────────────────────────────
// 6. 风险等级评估
// ─────────────────────────────────────────────

/** 风险等级优先级映射 */
const RISK_PRIORITY: Record<string, number> = {
  safe: 0,
  warning: 1,
  alert: 2,
  critical: 3,
};

/**
 * 根据触发的规则计算风险等级
 */
function computeRiskLevel(triggeredRules: string[]): 'safe' | 'warning' | 'alert' | 'critical' {
  if (triggeredRules.length === 0) return 'safe';

  const hasCritical = triggeredRules.includes('ENTROPY_SPIKE');
  const hasMultipleRules = triggeredRules.length >= 2;
  const hasAccelDrift = triggeredRules.includes('ACCEL_DRIFT');

  if (hasCritical) return 'critical';
  if (hasMultipleRules) return 'alert';
  if (hasAccelDrift) return 'warning';

  return 'warning';
}

/**
 * 计算置信度（基于数据点数量和规则一致性）
 */
function computeConfidence(step: number, triggeredRules: string[]): number {
  // 数据越充分，置信度越高
  const dataConfidence = Math.min(1, step / 10);
  // 多规则触发增加置信度
  const ruleConfidence = Math.min(1, triggeredRules.length / 3);
  return dataConfidence * 0.6 + ruleConfidence * 0.4;
}

// ─────────────────────────────────────────────
// 7. EntropyMonitor 主类
// ─────────────────────────────────────────────

/** 默认配置 */
const DEFAULT_CONFIG: EntropyMonitorConfig = {
  windowSize: 5,
  polyOrder: 2,
  accelThreshold: 0.15,
  jerkThreshold: 0.25,
  entropySpike: 2.0,
  consecutiveSteps: 3,
  streamingMode: true,
};

/**
 * 熵动力学监控器
 * 
 * 实时监控 LLM 推理过程中的熵变化，
 * 通过高阶导数检测异常行为模式。
 * 
 * @example
 * ```typescript
 * const monitor = new EntropyMonitor();
 * 
 * // 流式模式：逐步处理
 * for (const step of logprobStream) {
 *   const result = monitor.step(step);
 *   if (result.riskLevel === 'critical') {
 *     console.warn('检测到异常推理！');
 *   }
 * }
 * 
 * // 批量模式：分析完整推理链
 * const analysis = monitor.analyze(fullChain);
 * console.log(`异常比例: ${analysis.anomalyRatio}`);
 * ```
 */
export class EntropyMonitor {
  private config: EntropyMonitorConfig;
  private dynamics: EntropyDynamics;
  private stepCount: number = 0;
  private entropyHistory: number[] = [];
  private velocityHistory: number[] = [];
  private accelHistory: number[] = [];
  private jerkHistory: number[] = [];
  private results: MonitorResult[] = [];
  private anomalyCount: number = 0;

  constructor(config?: Partial<EntropyMonitorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dynamics = new EntropyDynamics();
  }

  /**
   * 处理单步 logprobs，返回实时监控结果
   * @param logprobs 当前步的 logprobs 数据
   * @returns 监控结果（含风险等级和触发规则）
   */
  step(logprobs: LogProbEntry[]): MonitorResult {
    // 1. 计算香农熵
    const logprobValues = logprobs.map(lp => lp.logprob);
    const entropy = shannonEntropy(logprobValues);

    // 2. 推入动力学引擎，获取高阶导数
    const { v, a, j } = this.dynamics.push(entropy);

    // 3. 保存历史
    this.entropyHistory.push(entropy);
    this.velocityHistory.push(v);
    this.accelHistory.push(a);
    this.jerkHistory.push(j);
    this.stepCount++;

    // 4. SG 滤波平滑
    const smoothedVelocities = savitzkyGolay(this.velocityHistory, this.config.windowSize, this.config.polyOrder);
    const smoothedAccelerations = savitzkyGolay(this.accelHistory, this.config.windowSize, this.config.polyOrder);
    const smoothedJerks = savitzkyGolay(this.jerkHistory, this.config.windowSize, this.config.polyOrder);

    const smoothedV = smoothedVelocities[smoothedVelocities.length - 1] ?? v;
    const smoothedA = smoothedAccelerations[smoothedAccelerations.length - 1] ?? a;
    const smoothedJ = smoothedJerks[smoothedJerks.length - 1] ?? j;

    // 5. 异常检测
    const triggeredRules: string[] = [];

    if (RULES.ACCEL_DRIFT(this.accelHistory, this.config.accelThreshold, this.config.consecutiveSteps)) {
      triggeredRules.push('ACCEL_DRIFT');
    }
    if (RULES.JERK_REVERSAL(this.jerkHistory, this.config.jerkThreshold)) {
      triggeredRules.push('JERK_REVERSAL');
    }
    if (this.entropyHistory.length >= 2) {
      const hPrev = this.entropyHistory[this.entropyHistory.length - 2];
      if (RULES.ENTROPY_SPIKE(entropy, hPrev, this.config.entropySpike)) {
        triggeredRules.push('ENTROPY_SPIKE');
      }
    }
    if (RULES.SUSTAINED_GROWTH(this.velocityHistory, this.config.consecutiveSteps)) {
      triggeredRules.push('SUSTAINED_GROWTH');
    }

    // 6. 计算风险等级
    const riskLevel = computeRiskLevel(triggeredRules);
    const confidence = computeConfidence(this.stepCount, triggeredRules);

    // 7. 统计异常
    if (riskLevel !== 'safe') {
      this.anomalyCount++;
    }

    // 8. 构建结果
    const result: MonitorResult = {
      step: this.stepCount - 1,
      entropy,
      velocity: v,
      acceleration: a,
      jerk: j,
      smoothedVelocity: smoothedV,
      smoothedAcceleration: smoothedA,
      smoothedJerk: smoothedJ,
      riskLevel,
      triggeredRules,
      confidence,
    };

    this.results.push(result);
    return result;
  }

  /**
   * 批量分析完整推理链
   * @param chain 完整推理链（多步 logprobs）
   * @returns 分析结果
   */
  analyze(chain: LogProbEntry[][]): ChainAnalysisResult {
    // 创建独立的监控实例，不污染 step() 的流式状态
    const monitor = new EntropyMonitor(this.config);
    const timeline: MonitorResult[] = [];

    for (let i = 0; i < chain.length; i++) {
      const result = monitor.step(chain[i]);
      timeline.push(result);
    }

    // 统计异常
    const anomalySteps = timeline.filter(r => r.riskLevel !== 'safe').length;
    const anomalyRatio = chain.length > 0 ? anomalySteps / chain.length : 0;

    // 最高风险等级
    const maxRiskLevel = timeline.reduce((max, r) => {
      return RISK_PRIORITY[r.riskLevel] > RISK_PRIORITY[max] ? r.riskLevel : max;
    }, 'safe' as string);

    // 意图漂移评分 (0-100)
    // 基于异常比例 + 平均加速度绝对值 + Jerk 波动
    const accelHistory = monitor.accelHistory;
    const jerkHistory = monitor.jerkHistory;
    const avgAccelAbs = accelHistory.length > 0
      ? accelHistory.reduce((s, v) => s + Math.abs(v), 0) / accelHistory.length
      : 0;
    const jerkStd = jerkHistory.length > 1
      ? Math.sqrt(jerkHistory.reduce((s, v) => s + v * v, 0) / jerkHistory.length)
      : 0;

    const intentDriftScore = Math.min(100, Math.round(
      anomalyRatio * 40 +
      Math.min(1, avgAccelAbs / 0.5) * 30 +
      Math.min(1, jerkStd / 1.0) * 30
    ));

    return {
      totalSteps: chain.length,
      anomalySteps,
      anomalyRatio,
      maxRiskLevel,
      intentDriftScore,
      timeline,
    };
  }

  /** 获取当前监控状态 */
  getStatus(): MonitorStatus {
    return {
      currentStep: this.stepCount,
      currentEntropy: this.entropyHistory.length > 0 ? this.entropyHistory[this.entropyHistory.length - 1] : 0,
      currentRisk: this.results.length > 0 ? this.results[this.results.length - 1].riskLevel : 'safe',
      anomaliesDetected: this.anomalyCount,
    };
  }

  /** 重置监控器状态 */
  reset(): void {
    this.dynamics.reset();
    this.stepCount = 0;
    this.entropyHistory = [];
    this.velocityHistory = [];
    this.accelHistory = [];
    this.jerkHistory = [];
    this.results = [];
    this.anomalyCount = 0;
  }
}
