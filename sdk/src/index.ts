/**
 * 🪞 MirrorAI — Open-Source AI Agent Security Evaluation Framework
 * 
 * 提供标准化的 Agent 行为评估工具：
 * - 行为录制 + Ed25519 签名
 * - 200+ 种敏感数据脱敏
 * - 5 维度 25 指标评测
 * - 53 种攻击场景测试
 * - 持续监控 + 预警
 */

import { Recorder } from './recorder';
import { Redactor } from './redactor';
import { Signer } from './signer';
import { ReporterV2 as Reporter } from './reporter-v2';
import type { ReportData } from './reporter-v2';
import { Academy } from './academy';
import { BlackboxConfig, DecisionRecord, AuditReport, Enrollment, EvalRecord, Badge, Certificate, Grade } from './types';
import { BlackboxError, BlackboxErrorCode } from './errors';

export { Recorder, Redactor, Signer, Reporter, Academy };
export type { BlackboxConfig, DecisionRecord, AuditReport, Enrollment, EvalRecord, Badge, Certificate, Grade };
export { BlackboxError, BlackboxErrorCode } from './errors';

// 对抗性评测引擎导出
export { AdversarialEngine } from './adversarial-engine';
export type { AttackScenario, AttackResult, EvalReport } from './adversarial-engine';
export { BUILTIN_SCENARIOS, getScenariosByCategory, getScenariosBySeverity, getScenarioStats } from './attack-scenarios';

// 存储模块导出
export {
  StorageAdapter,
  InMemoryStorage,
  PgStorage,
  createStorage,
  pgSchema,
} from './storage';
export type { PgStorageConfig, StorageFactoryConfig, StorageResult, SkillRecord, SignatureRecord } from './storage';

// P0 算法模块导出
export { RedactorV2, AhoCorasick } from './redactor-v2';
export type { TieredMatch, PatternDefinition, RedactorV2Config } from './redactor-v2';

export { ResponseAnalyzer, containsSensitiveInfo } from './response-analyzer';
export type { Severity, DetectionTier, DetectionResult, SemanticDetector, ResponseAnalyzerConfig } from './response-analyzer';

export { MerkleChain, computeEventHash } from './merkle-chain';
export type { ChainedEvent, ChainVerificationResult, ChainIssue, MerkleChainConfig } from './merkle-chain';

export { BayesianScorer, HallucinationDetector, bayesianMean } from './bayesian-scorer';
export type { MetricScore, DimensionScore, HallucinationResult, BayesianScorerConfig, HallucinationConfig, RadarData } from './bayesian-scorer';

export { ReporterV2 } from './reporter-v2';
export type { ReportFormat, SummaryLength, ReportDimension, AttackSummary, ReportData, DiffReportData, ReporterV2Config } from './reporter-v2';

export { KeyManager, hkdf } from './key-manager';
export type { KeyPair, RotatedKey, PublicKeyChainEntry, KeyManagerConfig, HKDFConfig } from './key-manager';

export { TieredStorage, MemoryAdapter, createDefaultStorage } from './storage/tiered-storage';
export type { StorageTier, StorageEntry, StorageQuery, IStorageAdapter, TieredStorageConfig, TieredStorageStats, QueryRouteResult, MigrationStats, MigrationPolicy } from './storage/tiered-storage';

// ─────────────────────────────────────────────
// P1 算法模块导出
// ─────────────────────────────────────────────

// 脱敏优化器
export { RedactorOptimizer, BloomFilter, StreamingRedactor, PatternFrequencySorter } from './redactor-optimizer';
export type { BloomFilterConfig, StreamingRedactorConfig, StreamingState, FrequencyStats } from './redactor-optimizer';

// Fuzzing 变异引擎
export { FuzzingEngine, runFuzzing } from './fuzzing-engine';
export type { AttackTemplate, MutatedAttack, ParallelConfig, FuzzingEngineConfig, FuzzingResult, MutationType } from './fuzzing-engine';

// 异步写入器
export { AsyncWriter, createAsyncWriter } from './async-writer';
export type { WriteEvent, FlushPolicy, AsyncWriterConfig, WriterStats } from './async-writer';

// 百分位基准对标 + 趋势追踪（增强 bayesian-scorer）
export { PercentileBenchmarking, TrendTracker } from './bayesian-scorer';
export type { PercentileBenchmark, TrendPoint, DimensionTrend, TrendTrackerConfig } from './bayesian-scorer';

// 智能摘要（增强 reporter-v2）
export { SmartSummaryGenerator } from './reporter-v2';
export type { SuggestionItem, SmartSummary } from './reporter-v2';

// Merkle 批量签名 + 可信时间戳（增强 key-manager — 方法已添加到 KeyManager 类）
export type { MerkleBatchSignature, TimestampedSignature, MerklePathNode } from './key-manager';

// ─────────────────────────────────────────────
// P2 算法模块导出
// ─────────────────────────────────────────────

// i18n 模式缓存（增强 redactor-optimizer）
export { I18nPatternCache } from './redactor-optimizer';
export type { I18nCacheEntry, I18nCacheStats } from './redactor-optimizer';

// 对抗性迭代循环（增强 fuzzing-engine — 方法已添加到 FuzzingEngine 类）
export type { AdversarialLoopConfig, IterationRound, AdversarialLoopResult } from './fuzzing-engine';

// 分页查询（增强 async-writer — 方法已添加到 AsyncWriter 类）
export type { QueryFilter, QueryParams, PaginationMeta, PaginatedResult } from './async-writer';

// 评分工具
export { scoreToGrade } from './grade-helper';

// 入学/毕业流程管理
export { AcademyFlow } from './academy-flow';
export type {
  Semester,
  CourseRecommendation,
  LearningPath,
  EnrollmentStage,
  EnrollmentFlow,
  GraduationCheck,
} from './academy-flow';

// 密钥撤销机制（增强 key-manager — 方法已添加到 KeyManager 类）
export type { RevocationEntry, RevocationAuditLog } from './key-manager';

// 一致性哈希分区（增强 tiered-storage）
export { ConsistentHashingRouter, ShardedTieredStorage } from './storage/tiered-storage';
export type { ShardInfo, ShardRouteResult, ConsistentHashingConfig } from './storage/tiered-storage';

// ─────────────────────────────────────────────
// 熵动力学监控 + 狄利克雷行为建模
// ─────────────────────────────────────────────
export { EntropyMonitor, EntropyDynamics, savitzkyGolay, shannonEntropy } from './entropy-monitor';
export type { EntropyMonitorConfig, LogProbEntry, MonitorResult, ChainAnalysisResult, MonitorStatus } from './entropy-monitor';

export { DirichletModel, ToolTransitionMatrix, mahalanobisDistance } from './dirichlet-model';
export type { DirichletConfig, ToolCallSequence, BehaviorAnalysis, ModelSnapshot } from './dirichlet-model';

// ─────────────────────────────────────────────
// Agent 护照系统
// ─────────────────────────────────────────────
export { PassportManager } from './passport';
export type { PassportCreateConfig } from './passport';
export type { AgentPassport, AgentChange, AgentChangeType } from './types';

// ─────────────────────────────────────────────
// 持续监控 + 预警系统
// ─────────────────────────────────────────────
export { AgentMonitor, RetestTrigger } from './monitor';
export type {
  AlertLevel,
  AlertType,
  Alert,
  MonitorConfig,
  RetestRecommendation,
} from './monitor';

// ─────────────────────────────────────────────
// 合规报告生成器
// ─────────────────────────────────────────────
export { generateEUAIActReport } from './compliance/eu-ai-act';
export type { RiskCategory, EUAIActReport } from './compliance/eu-ai-act';
export { generateSOC2Report } from './compliance/soc2';
export type { CriteriaStatus, CriteriaEntry, SOC2Report } from './compliance/soc2';
export { ComplianceExporter } from './compliance/exporter';
export type { ComplianceReport } from './compliance/exporter';

// ─────────────────────────────────────────────
// 自适应攻击生成模块（UCB 多臂老虎机）
// ─────────────────────────────────────────────
export { AdaptiveFuzzer, MUTATIONS } from './adaptive-fuzzer';
export type { FuzzerConfig, AttackArm } from './adaptive-fuzzer';

// ─────────────────────────────────────────────
// 轻量防篡改审计模块
// ─────────────────────────────────────────────
export { LightweightAudit } from './lightweight-audit';
export type { AuditEvent, AuditEntry, VerificationResult, AuditConfig } from './lightweight-audit';

// ─────────────────────────────────────────────
// SaaS 客户端
// ─────────────────────────────────────────────
export { MirrorAIClient } from './saas-client';
export type { SaasClientConfig, SyncResult } from './saas-client';

// ─────────────────────────────────────────────
// 实时防护层
// ─────────────────────────────────────────────
export { Guard } from './guard';
export type { GuardResult, GuardDecision, GuardConfig } from './guard';

export { Shield } from './shield';
export type { ShieldResult, ShieldDecision, ShieldConfig, Detection } from './shield';

export { Gate } from './gate';
export type { GateResult, GateDecision, GateConfig, ToolCall, ToolPermission } from './gate';

export { Interceptor } from './interceptor';
export type { InterceptorConfig, WrappedLLMFunction, WrappedToolFunction } from './interceptor';

// ─────────────────────────────────────────────
// 功能增强
// ─────────────────────────────────────────────
export { CryptoRedactor } from './crypto-redactor';
export type { EncryptedToken } from './crypto-redactor';

export { EvalSigner } from './eval-signer';
export type { SignedEvalStep } from './eval-signer';

export { AlertExplainer } from './alert-explainer';
export type { ExplainedAlert } from './alert-explainer';

export { CloudScenarioLibrary } from './cloud-scenarios';
export type { CloudScenarioConfig } from './cloud-scenarios';

export { Benchmark } from './benchmark';
export type { BenchmarkResult } from './benchmark';

export { VersionTracker } from './version-tracker';
export type { AgentSnapshot, VersionDiff } from './version-tracker';

/**
 * 验证 BlackboxConfig
 * @throws {BlackboxError} 配置无效时
 */
function validateConfig(config: BlackboxConfig): void {
  if (!config || typeof config !== 'object') {
    throw new BlackboxError(
      BlackboxErrorCode.INVALID_CONFIG,
      '配置必须是一个对象',
    );
  }
  if (!config.agentId || typeof config.agentId !== 'string' || config.agentId.trim().length === 0) {
    throw new BlackboxError(
      BlackboxErrorCode.MISSING_AGENT_ID,
      'agentId 是必填项，必须是非空字符串',
    );
  }
  if (config.mode === 'cloud' && (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim().length === 0)) {
    throw new BlackboxError(
      BlackboxErrorCode.MISSING_API_KEY,
      'mode 为 cloud 时，apiKey 是必填项',
    );
  }
  if (config.signingKey !== undefined && typeof config.signingKey !== 'string') {
    throw new BlackboxError(
      BlackboxErrorCode.INVALID_SIGNING_KEY,
      'signingKey 必须是字符串（base64 编码的 Ed25519 私钥）',
    );
  }
  if (config.maxRecords !== undefined && (typeof config.maxRecords !== 'number' || config.maxRecords <= 0 || !Number.isFinite(config.maxRecords))) {
    throw new BlackboxError(
      BlackboxErrorCode.INVALID_CONFIG,
      'maxRecords 必须是正整数',
    );
  }
  if (config.maxInputSize !== undefined && (typeof config.maxInputSize !== 'number' || config.maxInputSize <= 0 || !Number.isFinite(config.maxInputSize))) {
    throw new BlackboxError(
      BlackboxErrorCode.INVALID_CONFIG,
      'maxInputSize 必须是正整数',
    );
  }
}

/**
 * 明镜 Blackbox — 主类
 * 
 * @example
 * ```typescript
 * import { LobsterBlackbox } from '@lobster-academy/blackbox';
 * 
 * // 初始化
 * const box = new LobsterBlackbox({
 *   agentId: 'my-agent-001',
 *   mode: 'local',
 *   redact: { patterns: ['email', 'phone'] },
 * });
 * 
 * // 录制决策
 * const record = await box.record({
 *   input: { userMessage: '帮我发邮件' },
 *   reasoning: '检测到邮件发送请求',
 *   output: { action: 'send_email', status: 'sent' },
 * });
 * 
 * // 生成报告
 * const report = box.generateReport();
 * console.log(box.toText(report));
 * ```
 */
export class LobsterBlackbox {
  private recorder: Recorder;
  private reporter: Reporter;
  private academy: Academy;

  /**
   * 创建 Blackbox 实例
   * @param config 配置对象
   * @throws {BlackboxError} 配置无效时抛出
   */
  constructor(config: BlackboxConfig) {
    validateConfig(config);
    this.recorder = new Recorder(config);
    this.reporter = new Reporter();
    this.academy = new Academy(this.recorder.getSigner());
  }

  // ─────────────────────────────────────────────
  // 核心功能
  // ─────────────────────────────────────────────

  /**
   * 录制一条决策
   * @param data 决策数据（input/output 必填）
   * @returns 录制后的决策记录（含 ID、时间戳、哈希、签名）
   * @throws {BlackboxError} 数据无效或超出限制时
   */
  async record(data: Parameters<Recorder['record']>[0]): Promise<DecisionRecord> {
    try {
      return await this.recorder.record(data);
    } catch (e) {
      if (e instanceof BlackboxError) throw e;
      throw new BlackboxError(
        BlackboxErrorCode.INVALID_RECORD_DATA,
        `录制失败: ${e instanceof Error ? e.message : String(e)}`,
        e instanceof Error ? e : undefined,
      );
    }
  }

  /** 获取录制器 */
  getRecorder(): Recorder {
    return this.recorder;
  }

  /** 获取签名器 */
  getSigner(): Signer {
    return this.recorder.getSigner();
  }

  /** 生成新的 Ed25519 密钥对 */
  static generateKeyPair() {
    return Signer.generateKeyPair();
  }

  /** 获取记录数量 */
  get count(): number {
    return this.recorder.count;
  }

  /** 清空所有录制记录 */
  clear(): void {
    this.recorder.clear();
  }

  // ─────────────────────────────────────────────
  // 报告
  // ─────────────────────────────────────────────

  /**
   * 生成审计报告
   * @param options 可选的过滤条件（时间范围、记录类型）
   * @returns 审计报告（含统计摘要、异常检测、数字签名）
   */
  generateReport(options?: {
    from?: string;
    to?: string;
    include?: Array<'decisions' | 'toolCalls' | 'errors' | 'statistics' | 'anomalies'>;
  }): AuditReport {
    try {
      const records = this.recorder.getRecords();
      let filtered = records;
      if (options?.from || options?.to) {
        filtered = filtered.filter(r => {
          if (options.from && r.timestamp < options.from) return false;
          if (options.to && r.timestamp > options.to) return false;
          return true;
        });
      }
      if (options?.include && options.include.length > 0) {
        filtered = filtered.filter(r => {
          if (options.include!.includes('decisions') && r.type === 'decision') return true;
          if (options.include!.includes('toolCalls') && (r.type === 'tool_call' || r.toolCalls?.length)) return true;
          if (options.include!.includes('errors') && r.type === 'error') return true;
          return false;
        });
      }
      // Build simple audit report
      const decisions = filtered.filter(r => r.type === 'decision').length;
      const toolCalls = filtered.filter(r => r.type === 'tool_call').length;
      const errors = filtered.filter(r => r.type === 'error').length;
      const total = filtered.length;
      const avgDuration = filtered.reduce((s, r) => s + (r.duration || 0), 0) / Math.max(total, 1);
      
      // Anomaly detection
      const anomalies: any[] = [];
      const now = new Date().toISOString();
      
      // Error spike: error rate > 10%
      if (total > 0 && errors / total > 0.1) {
        anomalies.push({
          type: 'error_spike',
          severity: 'medium',
          message: `错误率 ${(errors / total * 100).toFixed(1)}% 超过 10% 阈值`,
          timestamp: now,
          count: errors,
          rate: errors / total,
        });
      }
      
      // High latency: duration > 10000ms
      const slowRecords = filtered.filter(r => (r.duration || 0) > 10000);
      if (slowRecords.length > 0) {
        const maxDuration = Math.max(...slowRecords.map(r => r.duration || 0));
        anomalies.push({
          type: 'high_latency',
          severity: maxDuration > 30000 ? 'critical' : maxDuration >= 15000 ? 'high' : 'medium',
          message: `检测到 ${slowRecords.length} 条高延迟记录，最大 ${maxDuration}ms`,
          timestamp: now,
          maxDuration,
          count: slowRecords.length,
        });
      }
      
      return {
        id: `report-${Date.now()}`,
        agentId: this.recorder.getAgentId() || 'unknown',
        generatedAt: new Date().toISOString(),
        period: { from: options?.from || '', to: options?.to || '' },
        summary: { totalDecisions: decisions, totalToolCalls: toolCalls, totalErrors: errors, avgDuration },
        records: filtered,
        anomalies,
      } as unknown as AuditReport;
    } catch (e) {
      if (e instanceof BlackboxError) throw e;
      throw new BlackboxError(
        BlackboxErrorCode.REPORT_GENERATION_FAILED,
        `报告生成失败: ${e instanceof Error ? e.message : String(e)}`,
        e instanceof Error ? e : undefined,
      );
    }
  }

  /** 将 AuditReport 转换为 ReporterV2 兼容的 ReportData
   *  注：AuditReport 运行时包含 id/agentId/period 等字段，但类型定义尚未同步，
   *  因此此处使用一次性类型断言而非逐字段 as any。
   */
  private toReportData(report: AuditReport): ReportData {
    const r = report as unknown as ReportData;
    return {
      id: r.id || `report-${Date.now()}`,
      agentId: r.agentId || 'unknown',
      title: 'Blackbox 审计报告',
      totalScore: 0,
      grade: '-',
      dimensions: [],
      period: r.period || { from: '', to: '' },
      generatedAt: r.generatedAt || new Date().toISOString(),
    };
  }

  /**
   * 生成文本格式报告
   * @param report 审计报告
   * @returns 格式化的文本报告
   */
  toText(report: AuditReport): string {
    if (!report) throw new BlackboxError(BlackboxErrorCode.REPORT_GENERATION_FAILED, 'report is required');
    try {
      return this.reporter.toText(this.toReportData(report));
    } catch {
      return `=== 审计报告 ===\nAgent: ${(report as any).agentId || 'unknown'}\n时间: ${(report as any).generatedAt || ''}\n\n` + JSON.stringify(report, null, 2);
    }
  }

  /**
   * 生成 JSON 格式报告
   * @param report 审计报告
   * @returns JSON 字符串
   */
  toJSON(report: AuditReport): string {
    if (!report) throw new BlackboxError(BlackboxErrorCode.REPORT_GENERATION_FAILED, 'report is required');
    return JSON.stringify(report);
  }

  /**
   * 生成 HTML 格式报告
   * @param report 审计报告
   * @returns HTML 字符串
   */
  toHTML(report: AuditReport): string {
    if (!report) throw new BlackboxError(BlackboxErrorCode.REPORT_GENERATION_FAILED, 'report is required');
    try {
      return this.reporter.toHTML(this.toReportData(report));
    } catch {
      return `<pre>${JSON.stringify(report, null, 2)}</pre>`;
    }
  }

  /**
   * 生成 Markdown 格式报告
   * @param report 审计报告
   * @returns Markdown 字符串
   */
  toMarkdown(report: AuditReport): string {
    if (!report) throw new BlackboxError(BlackboxErrorCode.REPORT_GENERATION_FAILED, 'report is required');
    try {
      return this.reporter.toMarkdown(this.toReportData(report));
    } catch {
      return '```json\n' + JSON.stringify(report, null, 2) + '\n```';
    }
  }

  /**
   * 验证审计报告的签名完整性
   * @param report 审计报告
   * @param publicKey Ed25519 公钥（base64）
   * @returns 签名是否有效
   */
  static verifyReport(report: AuditReport, publicKey: string): boolean {
    if (!report || !report.signature || !publicKey) return false;
    try {
      const { signature, ...data } = report;
      return Signer.verify(JSON.stringify(data), signature, publicKey);
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // 🪞 学院系统
  // ─────────────────────────────────────────────

  /**
   * 🎓 注册入学
   * @param department 院系（chatbot/agent/saas/fintech/healthcare/general）
   * @returns 入学信息
   */
  enroll(department = 'general'): Enrollment {
    return this.academy.enroll(this.recorder.getAgentId(), department);
  }

  /** 获取入学信息 */
  getEnrollment(): Enrollment | null {
    return this.academy.getEnrollment();
  }

  /** 获取入学通知书文本 */
  welcomeLetter(): string {
    return this.academy.welcomeLetter();
  }

  /**
   * 📝 记录评测结果
   * @param dims 各维度分数
   * @param agentVersion Agent 版本号（可选）
   * @returns 评测记录
   */
  recordEval(dims: EvalRecord['dimensions'], agentVersion?: string): EvalRecord {
    return this.academy.recordEval(dims, agentVersion);
  }

  /** 获取评测历史 */
  getHistory(): EvalRecord[] {
    return this.academy.getHistory();
  }

  /** 获取最新评测 */
  getLatestEval(): EvalRecord | null {
    return this.academy.getLatestEval();
  }

  /** 获取进步数据（需至少2次评测） */
  getProgress() {
    return this.academy.getProgress();
  }

  /** 获取成绩单文本 */
  transcript(): string {
    return this.academy.transcript();
  }

  /** 获取所有徽章 */
  getBadges(): Badge[] {
    return this.academy.getBadges();
  }

  /** 获取已解锁徽章 */
  getUnlockedBadges(): Badge[] {
    return this.academy.getUnlockedBadges();
  }

  /**
   * 🎓 颁发毕业证书（需 S 级）
   * @returns 毕业证书（非 S 级返回 null）
   */
  graduate(): Certificate | null {
    return this.academy.graduate();
  }

  /** 获取毕业证书文本 */
  certificateText(cert: Certificate): string {
    return this.academy.certificateText(cert);
  }

  /** 获取所有证书 */
  getCertificates(): Certificate[] {
    return this.academy.getCertificates();
  }

  /**
   * 🔁 续学检查
   * @param currentVersion 当前 Agent 版本号
   * @returns 是否建议续学及原因
   */
  reEnrollCheck(currentVersion: string) {
    return this.academy.reEnrollCheck(currentVersion);
  }
}
