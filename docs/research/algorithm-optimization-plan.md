# Lobster Academy 算法优化方案

**版本**：v1.0
**日期**：2026-03-30
**基于**：三份Deep Research报告 + 现有代码库分析

---

## 一、现状分析

### 1.1 当前技术栈

Lobster Academy SDK 已有以下算法模块：

| 模块 | 文件 | 算法基础 | 原创度 |
|------|------|---------|--------|
| 脱敏引擎 | `redactor-v2.ts` | Aho-Corasick + 三层分层匹配 | 中等 |
| 贝叶斯评分 | `bayesian-scorer.ts` | Beta分布 + 4层幻觉检测 | 中等 |
| 响应分析 | `response-analyzer.ts` | 4层检测（模式/语义/结构/推理链） | 中等 |
| Merkle链 | `merkle-chain.ts` | SHA256 + 链式哈希 | 低 |
| Ed25519签名 | `signer.ts` | 标准Ed25519 | 低 |
| Fuzzing引擎 | `fuzzing-engine.ts` | 模板变异 + Bandit | 低 |
| 监控 | `monitor.ts` | 滑动窗口异常检测 | 低 |

### 1.2 核心差距

1. **推理链监控缺失** — 当前没有实时监控Agent推理过程的能力
2. **行为建模缺失** — 没有把Agent行为建模为图/向量的方法
3. **防篡改效率低** — Merkle链在长序列下性能退化
4. **攻击生成静态** — Fuzzing引擎的变异策略是预定义的

---

## 二、优化方案总览

### 2.1 新增3个核心算法模块

```
┌─────────────────────────────────────────────────────────┐
│                   Lobster Academy SDK                    │
├──────────────┬──────────────────┬───────────────────────┤
│  现有模块     │   新增模块        │   增强模块            │
│              │                  │                       │
│  RedactorV2  │  EntropyMonitor  │  MerkleChain (轻量版)  │
│  BayesianScorer│ DirichletModel │  FuzzingEngine (自适应)│
│  ResponseAnalyzer│ SemanticKinematics│                   │
│  Monitor     │                  │                       │
└──────────────┴──────────────────┴───────────────────────┘
```

### 2.2 优先级排序

| 优先级 | 模块 | 核心创新 | 预计工时 |
|--------|------|---------|---------|
| 🔴 P1 | 熵动力学监控 | 熵三阶导数(Jerk)检测意图偏移 | 1周 |
| 🔴 P2 | 狄利克雷行为建模 | 贝叶斯分布+马氏距离异常检测 | 1周 |
| 🟠 P3 | 轻量防篡改 | 哈希分层映射替代全量Merkle链 | 3天 |
| 🟡 P4 | 自适应攻击生成 | Bandit算法动态选攻击策略 | 1周 |

---

## 三、详细设计方案

### 3.1 熵动力学监控（EntropyMonitor）

**文件**：`sdk/src/entropy-monitor.ts`（新建）

**核心思想**：将Agent的推理过程视为物理动力系统，通过监控LLM输出概率分布的香农熵及其高阶导数，在不理解语义的前提下，纯数学检测"意图偏移"。

#### 算法设计

```
输入：Agent每步推理的logprobs（对数概率分布）
输出：实时风险评分 + 异常警报

Step 1: 计算香农熵
  H(t) = -Σ p(i,t) × log₂(p(i,t))
  其中 p(i,t) = 第t步token i的概率

Step 2: 计算熵的三阶导数
  速度:   v(t) = dH/dt ≈ H(t) - H(t-1)
  加速度: a(t) = d²H/dt² ≈ v(t) - v(t-1)
  Jerk:   j(t) = d³H/dt³ ≈ a(t) - a(t-1)

Step 3: Savitzky-Golay平滑滤波
  对v(t), a(t), j(t)分别应用SG滤波器（窗口=5, 多项式阶=2）
  去除噪声，保留真实趋势

Step 4: 异常检测规则
  Rule 1: a(t) > θ_a 且持续3步 → 意图正在加速偏离（警告）
  Rule 2: j(t) 符号反转且幅度 > θ_j → 行为模式发生相变（警报）
  Rule 3: H(t) 突增 > ΔH_max → 不确定性爆发（高风险）
  Rule 4: v(t) 持续正增长5步 → 连贯性崩溃趋势（警告）
```

#### 参数配置

```typescript
interface EntropyMonitorConfig {
  windowSize: number;        // SG滤波窗口大小，默认5
  polyOrder: number;         // SG多项式阶数，默认2
  accelThreshold: number;    // 加速度阈值θ_a，默认0.15
  jerkThreshold: number;     // Jerk阈值θ_j，默认0.25
  entropySpike: number;      // 熵突增阈值ΔH_max，默认2.0
  consecutiveSteps: number;  // 连续异常步数阈值，默认3
  streamingMode: boolean;    // 流式模式（实时计算），默认true
}
```

#### 接口设计

```typescript
class EntropyMonitor {
  constructor(config?: Partial<EntropyMonitorConfig>);

  /**
   * 处理单步推理的logprobs
   * @param logprobs - 当前步的对数概率分布
   * @returns 实时监控结果
   */
  step(logprobs: LogProbEntry[]): MonitorResult;

  /**
   * 批量处理历史推理链
   * @param chain - 完整的推理链
   * @returns 全链路分析结果
   */
  analyze(chain: LogProbEntry[][]): ChainAnalysisResult;

  /**
   * 获取当前状态摘要
   */
  getStatus(): MonitorStatus;

  /**
   * 重置监控状态
   */
  reset(): void;
}

interface MonitorResult {
  step: number;
  entropy: number;           // 当前熵值H(t)
  velocity: number;          // 熵速度v(t)
  acceleration: number;      // 熵加速度a(t)
  jerk: number;              // 熵Jerk j(t)
  riskLevel: 'safe' | 'warning' | 'alert' | 'critical';
  triggeredRules: string[];  // 命中的检测规则
  confidence: number;        // 置信度 0-1
}

interface ChainAnalysisResult {
  totalSteps: number;
  anomalySteps: number;
  anomalyRatio: number;
  maxRiskLevel: string;
  intentDriftScore: number;  // 0-100，越高越危险
  timeline: MonitorResult[];
}
```

#### 核心代码框架

```typescript
// Savitzky-Golay 滤波器
function savitzkyGolay(data: number[], windowSize: number, polyOrder: number): number[] {
  // SG卷积系数预计算
  const coeffs = computeSGCoefficients(windowSize, polyOrder);
  // 边界处理 + 卷积
  return convolve(data, coeffs);
}

// 香农熵计算
function shannonEntropy(logprobs: number[]): number {
  const probs = logprobs.map(lp => Math.exp(lp));
  const sum = probs.reduce((a, b) => a + b, 0);
  return -probs.reduce((H, p) => {
    const normalized = p / sum;
    return H + (normalized > 0 ? normalized * Math.log2(normalized) : 0);
  }, 0);
}

// 熵动力学计算
class EntropyDynamics {
  private history: number[] = [];
  private velocityHistory: number[] = [];
  private accelHistory: number[] = [];

  push(entropy: number): { v: number; a: number; j: number } {
    this.history.push(entropy);
    const v = this.history.length >= 2
      ? entropy - this.history[this.history.length - 2] : 0;
    this.velocityHistory.push(v);
    const a = this.velocityHistory.length >= 2
      ? v - this.velocityHistory[this.velocityHistory.length - 2] : 0;
    this.accelHistory.push(a);
    const j = this.accelHistory.length >= 2
      ? a - this.accelHistory[this.accelHistory.length - 2] : 0;
    return { v, a, j };
  }
}
```

---

### 3.2 狄利克雷行为建模（DirichletModel）

**文件**：`sdk/src/dirichlet-model.ts`（新建）

**核心思想**：用狄利克雷分布对Agent的工具调用转移概率进行贝叶斯建模，定义"正常行为"的置信流形，用马氏距离实时检测异常。

#### 算法设计

```
输入：Agent历史工具调用序列
输出：行为指纹 + 异常评分

Step 1: 构建工具调用转移矩阵
  T[i][j] = 工具i调用后调用工具j的次数
  归一化得到概率矩阵 P[i][j] = T[i][j] / ΣT[i]

Step 2: 狄利克雷分布建模
  对每个工具i的调用分布 P[i] 建模为狄利克雷分布
  先验：α₀ = [1, 1, ..., 1]（均匀先验）
  后验：α = α₀ + observed_counts

Step 3: 行为指纹提取
  将后验分布的均值向量作为行为指纹
  fingerprint[i] = α[i] / Σα

Step 4: 马氏距离异常检测
  用历史安全执行日志估计协方差矩阵 Σ
  新行为指纹 x 到基线的马氏距离：
  d = √((x-μ)ᵀ Σ⁻¹ (x-μ))
  d > 阈值 → 异常

Step 5: 动态更新
  每次新的安全执行后，更新狄利克雷后验参数
  实现在线学习，适应Agent行为的正常演变
```

#### 接口设计

```typescript
interface DirichletConfig {
  priorAlpha: number;        // 狄利克雷先验α，默认1.0
  anomalyThreshold: number;  // 马氏距离阈值，默认3.0（3σ）
  minSamples: number;        // 最少样本数才开始检测，默认10
  onlineLearning: boolean;   // 是否在线更新，默认true
}

class DirichletBehaviorModel {
  constructor(tools: string[], config?: Partial<DirichletConfig>);

  /**
   * 从历史数据训练基线模型
   */
  train(sequences: ToolCallSequence[]): void;

  /**
   * 检测单个行为序列是否异常
   */
  detect(sequence: ToolCallSequence): BehaviorAnalysis;

  /**
   * 在线学习：用新的安全执行更新模型
   */
  update(sequence: ToolCallSequence): void;

  /**
   * 获取当前行为指纹
   */
  getFingerprint(): number[];

  /**
   * 导出模型参数（用于持久化）
   */
  export(): ModelSnapshot;

  /**
   * 导入模型参数
   */
  import(snapshot: ModelSnapshot): void;
}

interface BehaviorAnalysis {
  normal: boolean;
  mahalanobisDistance: number;
  riskLevel: 'safe' | 'warning' | 'alert' | 'critical';
  deviantTools: string[];     // 偏离最大的工具
  fingerprint: number[];
}
```

---

### 3.3 轻量防篡改（LightweightAudit）

**文件**：`sdk/src/lightweight-audit.ts`（新建）

**核心思想**：用哈希分层映射替代全量Merkle链，在长序列场景下保持恒定验证延迟。

#### 算法设计

```
传统Merkle链：验证延迟 = O(N)（N为序列长度）
我们的方案：验证延迟 = O(log N)

设计：
  将事件序列分成固定大小的块（blockSize=64）
  每个块内部用增量哈希（只哈希变化部分）
  块之间构建轻量Merkle树（仅2层）
  支持增量追加，不需要重建整个树

事件哈希：
  hash(event_i) = SHA256(data_i + hash(event_{i-1}))

块哈希：
  blockHash = SHA256(Σ hash(event_i))

根哈希：
  rootHash = SHA256(blockHash_1 + blockHash_2 + ...)

验证单个事件：
  只需要验证：eventHash + 块内邻居哈希 + 块哈希
  复杂度：O(log N) 而非 O(N)
```

#### 接口设计

```typescript
interface AuditConfig {
  blockSize: number;         // 块大小，默认64
  algorithm: 'sha256' | 'sha512';
  seed?: string;             // 初始种子
}

class LightweightAudit {
  constructor(config?: Partial<AuditConfig>);

  /**
   * 追加事件并返回哈希
   */
  append(event: AuditEvent): AuditEntry;

  /**
   * 验证单个事件的完整性
   */
  verify(entry: AuditEntry): VerificationResult;

  /**
   * 验证整个链的完整性
   */
  verifyAll(): ChainVerificationResult;

  /**
   * 获取当前根哈希
   */
  getRootHash(): string;

  /**
   * 获取事件总数
   */
  size(): number;
}
```

---

### 3.4 自适应攻击生成（AdaptiveFuzzer）

**文件**：`sdk/src/adaptive-fuzzer.ts`（新建）

**核心思想**：用UCB（Upper Confidence Bound）算法动态选择最有效的攻击策略，从53个基础场景扩展到无限变体。

#### 算法设计

```
每个攻击策略 = 一个arm
奖励 = 攻击是否成功绕过Agent防御
UCB选择：score = avg_reward + √(2 × ln(total_plays) / arm_plays)

自适应流程：
  1. 初始化53个基础攻击场景
  2. 每轮选择UCB得分最高的攻击
  3. 对选中的攻击进行变异（9种变异操作）
  4. 执行攻击，观察Agent响应
  5. 更新该arm的奖励统计
  6. 重复2-5直到收敛或达到预算

变异操作矩阵：
  synonym × base64 = 同义替换后Base64编码
  unicode × separator = Unicode变体+分隔符替换
  leetspeak × noise = Leetspeak+噪声注入
  ...（共9×9=81种组合）
```

#### 接口设计

```typescript
interface FuzzerConfig {
  maxRounds: number;         // 最大轮数，默认50
  mutationsPerRound: number; // 每轮变异数，默认5
  ucbExploration: number;    // UCB探索系数，默认2.0
  convergenceThreshold: number; // 收敛阈值，默认3轮无新发现
}

class AdaptiveFuzzer {
  constructor(scenarios: AttackScenario[], config?: Partial<FuzzerConfig>);

  /**
   * 运行自适应攻击测试
   */
  async run(agentFn: AgentFunction): Promise<FuzzingReport>;

  /**
   * 获取当前UCB得分
   */
  getUCBScores(): Map<string, number>;

  /**
   * 获取攻击有效性排名
   */
  getEffectivenessRanking(): AttackRanking[];
}
```

---

## 四、实现计划

### 4.1 时间线

```
Week 1: 熵动力学监控（EntropyMonitor）
  Day 1-2: 香农熵计算 + 三阶导数
  Day 3-4: SG滤波器实现 + 异常检测规则
  Day 5: 集成测试 + 文档

Week 2: 狄利克雷行为建模（DirichletModel）
  Day 1-2: 转移矩阵 + 狄利克雷分布
  Day 3-4: 马氏距离计算 + 在线学习
  Day 5: 集成测试 + 文档

Week 3: 轻量防篡改 + 自适应攻击生成
  Day 1-2: LightweightAudit实现
  Day 3-5: AdaptiveFuzzer实现

Week 4: 集成 + 测试 + 发布
  Day 1-2: 全模块集成测试
  Day 3: 性能基准测试
  Day 4-5: 文档 + README更新 + 发布
```

### 4.2 依赖

| 模块 | 外部依赖 | 内部依赖 |
|------|---------|---------|
| EntropyMonitor | 无 | 无 |
| DirichletModel | 无 | 无 |
| LightweightAudit | crypto(Node) | 无 |
| AdaptiveFuzzer | 无 | AdversarialEngine |

**全部不需要额外npm包，仅用Node.js内置crypto + 数学计算。**

### 4.3 测试策略

每个模块需要：
1. **单元测试** — 核心算法正确性
2. **边界测试** — 空输入、超长输入、极端值
3. **性能测试** — 延迟基准（目标：<1ms/步）
4. **集成测试** — 与现有模块的配合

---

## 五、预期成果

### 5.1 技术指标

| 指标 | 目标 |
|------|------|
| 熵监控单步延迟 | < 0.5ms |
| 行为检测单次延迟 | < 2ms |
| 防篡改验证延迟 | O(log N) |
| 攻击变体扩展倍数 | 53 → 500+ |
| 意图偏移检测召回率 | > 85%（目标90%） |
| 误报率 | < 5% |

### 5.2 商业价值

1. **差异化卖点** — 业界首个"语义运动学"Agent安全监控
2. **学术发表** — 论文题目：《Semantic Kinematics: Real-time Intent Drift Detection in AI Agent Reasoning Chains via Entropy Dynamics》
3. **企业客户** — 实时CoT监控是金融/医疗行业的刚需
4. **开源社区** — 独特算法吸引star和贡献者

### 5.3 风险与缓解

| 风险 | 概率 | 缓解措施 |
|------|------|---------|
| Logprobs接口不可用 | 低 | 提供embedding回退方案 |
| 熵变化不够显著 | 中 | 结合多维度（熵+行为图+工具调用）综合判断 |
| 狄利克雷先验不适合 | 低 | 支持自定义先验+在线学习 |
| 性能不达标 | 低 | 全部纯数学，不做LLM调用 |

---

## 六、总结

本方案通过4个新增模块，将Lobster Academy从"53种攻击测试工具"升级为"实时、可量化、防篡改的Agent安全评估平台"。

**核心创新**：
1. 熵动力学监控 — 物理学概念引入LLM安全
2. 狄利克雷行为建模 — 严格的统计学"正常范围"
3. 轻量防篡改 — 恒定验证延迟
4. 自适应攻击生成 — 从53到无限

**全部不需要GPU，不需要额外LLM，纯数学+密码学。**

**预计4周完成全部实现，1个月后可发论文+推产品。**
