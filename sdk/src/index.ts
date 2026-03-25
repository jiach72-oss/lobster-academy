/**
 * 龙虾学院 Blackbox SDK — 主入口
 * 每只龙虾都该有一个黑匣子
 */

import { Recorder } from './recorder';
import { Redactor } from './redactor';
import { Signer } from './signer';
import { Reporter } from './reporter';
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
 * 龙虾学院 Blackbox — 主类
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
    this.reporter = new Reporter(config.agentId, this.recorder.getSigner());
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
      return this.reporter.generateReport(filtered, {
        from: options?.from,
        to: options?.to,
      });
    } catch (e) {
      if (e instanceof BlackboxError) throw e;
      throw new BlackboxError(
        BlackboxErrorCode.REPORT_GENERATION_FAILED,
        `报告生成失败: ${e instanceof Error ? e.message : String(e)}`,
        e instanceof Error ? e : undefined,
      );
    }
  }

  /**
   * 生成文本格式报告
   * @param report 审计报告
   * @returns 格式化的文本报告
   */
  toText(report: AuditReport): string {
    return this.reporter.toText(report);
  }

  /**
   * 生成 JSON 格式报告
   * @param report 审计报告
   * @returns JSON 字符串
   */
  toJSON(report: AuditReport): string {
    return this.reporter.toJSON(report);
  }

  /**
   * 生成 HTML 格式报告
   * @param report 审计报告
   * @returns HTML 字符串
   */
  toHTML(report: AuditReport): string {
    return this.reporter.toHTML(report);
  }

  /**
   * 生成 Markdown 格式报告
   * @param report 审计报告
   * @returns Markdown 字符串
   */
  toMarkdown(report: AuditReport): string {
    return this.reporter.toMarkdown(report);
  }

  /**
   * 验证审计报告的签名完整性
   * @param report 审计报告
   * @param publicKey Ed25519 公钥（base64）
   * @returns 签名是否有效
   */
  static verifyReport(report: AuditReport, publicKey: string): boolean {
    return Reporter.verifyReport(report, publicKey);
  }

  // ─────────────────────────────────────────────
  // 🦞 学院系统
  // ─────────────────────────────────────────────

  /**
   * 🎓 注册入学
   * @param department 院系（chatbot/agent/saas/fintech/healthcare/general）
   * @returns 入学信息
   */
  enroll(department = 'general'): Enrollment {
    return this.academy.enroll(this.recorder['agentId'], department);
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
