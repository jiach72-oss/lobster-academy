/**
 * 明镜 Blackbox SDK — 内存存储实现
 * 用作降级方案或开发/测试环境
 */

import {
  DecisionRecord, RecordType,
  Enrollment, EvalRecord, Badge, Certificate,
  AuditReport,
} from '../types';
import { StorageAdapter, SkillRecord, SignatureRecord } from './storage-adapter';

export class InMemoryStorage implements StorageAdapter {
  private records: Map<string, DecisionRecord[]> = new Map(); // agentId -> records
  private enrollments: Map<string, Enrollment> = new Map();
  private evalHistory: Map<string, EvalRecord[]> = new Map();
  private badges: Map<string, Badge[]> = new Map();
  private certificates: Map<string, Certificate[]> = new Map();
  private reports: Map<string, AuditReport[]> = new Map();
  private skills: SkillRecord[] = [];
  private signatures: SignatureRecord[] = [];
  private _connected = true;
  private maxRecords: number;

  constructor(maxRecords = 10000) {
    this.maxRecords = maxRecords;
  }

  // ─────────────────────────────────────────────
  // 录制记录
  // ─────────────────────────────────────────────

  async saveRecord(record: DecisionRecord): Promise<void> {
    const agentRecords = this.records.get(record.agentId) ?? [];
    agentRecords.push(record);
    // Enforce per-agent record cap
    if (agentRecords.length > this.maxRecords) {
      agentRecords.splice(0, agentRecords.length - this.maxRecords);
    }
    this.records.set(record.agentId, agentRecords);
  }

  async saveRecords(records: DecisionRecord[]): Promise<void> {
    for (const r of records) {
      await this.saveRecord(r);
    }
  }

  async getRecords(agentId?: string): Promise<DecisionRecord[]> {
    if (agentId) {
      return JSON.parse(JSON.stringify(this.records.get(agentId) ?? []));
    }
    const all: DecisionRecord[] = [];
    for (const recs of this.records.values()) {
      all.push(...recs);
    }
    return JSON.parse(JSON.stringify(all));
  }

  async getRecordsByType(type: RecordType, agentId?: string): Promise<DecisionRecord[]> {
    const records = await this.getRecords(agentId);
    return records.filter(r => r.type === type);
  }

  async getRecordsByPeriod(agentId: string, from?: string, to?: string): Promise<DecisionRecord[]> {
    const records = await this.getRecords(agentId);
    return records.filter(r => {
      if (from && r.timestamp < from) return false;
      if (to && r.timestamp > to) return false;
      return true;
    });
  }

  async clearRecords(agentId?: string): Promise<void> {
    if (agentId) {
      this.records.delete(agentId);
    } else {
      throw new Error('clearRecords requires an agentId to prevent accidental full-table deletion');
    }
  }

  async countRecords(agentId?: string): Promise<number> {
    if (agentId) {
      return this.records.get(agentId)?.length ?? 0;
    }
    let total = 0;
    for (const recs of this.records.values()) {
      total += recs.length;
    }
    return total;
  }

  // ─────────────────────────────────────────────
  // 入学信息
  // ─────────────────────────────────────────────

  async saveEnrollment(enrollment: Enrollment): Promise<void> {
    this.enrollments.set(enrollment.agentId, enrollment);
  }

  async getEnrollment(agentId: string): Promise<Enrollment | null> {
    return this.enrollments.get(agentId) ?? null;
  }

  // ─────────────────────────────────────────────
  // 评测记录
  // ─────────────────────────────────────────────

  async saveEval(agentId: string, evalRecord: EvalRecord): Promise<void> {
    const history = this.evalHistory.get(agentId) ?? [];
    history.push(evalRecord);
    this.evalHistory.set(agentId, history);
  }

  async getEvalHistory(agentId: string): Promise<EvalRecord[]> {
    return [...(this.evalHistory.get(agentId) ?? [])];
  }

  // ─────────────────────────────────────────────
  // 徽章
  // ─────────────────────────────────────────────

  async saveBadges(agentId: string, badgeList: Badge[]): Promise<void> {
    this.badges.set(agentId, badgeList);
  }

  async getBadges(agentId: string): Promise<Badge[]> {
    return [...(this.badges.get(agentId) ?? [])];
  }

  // ─────────────────────────────────────────────
  // 证书
  // ─────────────────────────────────────────────

  async saveCertificate(cert: Certificate): Promise<void> {
    const certs = this.certificates.get(cert.agentId) ?? [];
    certs.push(cert);
    this.certificates.set(cert.agentId, certs);
  }

  async getCertificates(agentId: string): Promise<Certificate[]> {
    return [...(this.certificates.get(agentId) ?? [])];
  }

  // ─────────────────────────────────────────────
  // 报告
  // ─────────────────────────────────────────────

  async saveReport(report: AuditReport): Promise<void> {
    const reports = this.reports.get(report.agentId) ?? [];
    reports.push(report);
    this.reports.set(report.agentId, reports);
  }

  async getReports(agentId: string): Promise<AuditReport[]> {
    return [...(this.reports.get(agentId) ?? [])];
  }

  // ─────────────────────────────────────────────
  // 技能库
  // ─────────────────────────────────────────────

  async saveSkill(skill: SkillRecord): Promise<void> {
    const idx = this.skills.findIndex(s => s.id === skill.id);
    if (idx >= 0) {
      this.skills[idx] = skill;
    } else {
      this.skills.push(skill);
    }
  }

  async getSkills(): Promise<SkillRecord[]> {
    return [...this.skills];
  }

  async getSkillsByCategory(category: string): Promise<SkillRecord[]> {
    return this.skills.filter(s => s.category === category);
  }

  // ─────────────────────────────────────────────
  // 签名记录
  // ─────────────────────────────────────────────

  async saveSignature(sig: SignatureRecord): Promise<void> {
    this.signatures.push(sig);
  }

  async getSignatures(agentId: string): Promise<SignatureRecord[]> {
    return this.signatures.filter(s => s.agentId === agentId);
  }

  // ─────────────────────────────────────────────
  // 生命周期
  // ─────────────────────────────────────────────

  async initialize(): Promise<void> {
    // 内存存储无需初始化
  }

  async close(): Promise<void> {
    this._connected = false;
  }

  isConnected(): boolean {
    return this._connected;
  }
}
