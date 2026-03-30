/**
 * 明镜 Blackbox SDK — 存储适配器接口
 * 抽象存储层，支持内存/PostgreSQL等多种后端
 */

import {
  DecisionRecord, RecordType,
  Enrollment, EvalRecord, Badge, Certificate,
  AuditReport,
} from '../types';

/** 存储适配器接口 */
export interface StorageAdapter {
  // ─────────────────────────────────────────────
  // 录制记录
  // ─────────────────────────────────────────────

  /** 保存一条记录 */
  saveRecord(record: DecisionRecord): Promise<void>;

  /** 批量保存记录 */
  saveRecords(records: DecisionRecord[]): Promise<void>;

  /** 获取所有记录（可选按agentId过滤） */
  getRecords(agentId?: string): Promise<DecisionRecord[]>;

  /** 按类型筛选记录 */
  getRecordsByType(type: RecordType, agentId?: string): Promise<DecisionRecord[]>;

  /** 按时间范围查询记录 */
  getRecordsByPeriod(agentId: string, from?: string, to?: string): Promise<DecisionRecord[]>;

  /** 清空记录（可选按agentId过滤） */
  clearRecords(agentId?: string): Promise<void>;

  /** 获取记录数量 */
  countRecords(agentId?: string): Promise<number>;

  // ─────────────────────────────────────────────
  // 入学信息
  // ─────────────────────────────────────────────

  /** 保存入学信息 */
  saveEnrollment(enrollment: Enrollment): Promise<void>;

  /** 获取入学信息 */
  getEnrollment(agentId: string): Promise<Enrollment | null>;

  // ─────────────────────────────────────────────
  // 评测记录
  // ─────────────────────────────────────────────

  /** 保存评测记录 */
  saveEval(agentId: string, evalRecord: EvalRecord): Promise<void>;

  /** 获取评测历史 */
  getEvalHistory(agentId: string): Promise<EvalRecord[]>;

  // ─────────────────────────────────────────────
  // 徽章
  // ─────────────────────────────────────────────

  /** 保存徽章列表 */
  saveBadges(agentId: string, badges: Badge[]): Promise<void>;

  /** 获取徽章列表 */
  getBadges(agentId: string): Promise<Badge[]>;

  // ─────────────────────────────────────────────
  // 证书
  // ─────────────────────────────────────────────

  /** 保存证书 */
  saveCertificate(cert: Certificate): Promise<void>;

  /** 获取证书列表 */
  getCertificates(agentId: string): Promise<Certificate[]>;

  // ─────────────────────────────────────────────
  // 报告
  // ─────────────────────────────────────────────

  /** 保存审计报告 */
  saveReport(report: AuditReport): Promise<void>;

  /** 获取审计报告列表 */
  getReports(agentId: string): Promise<AuditReport[]>;

  // ─────────────────────────────────────────────
  // 技能库
  // ─────────────────────────────────────────────

  /** 保存技能 */
  saveSkill(skill: SkillRecord): Promise<void>;

  /** 获取所有技能 */
  getSkills(): Promise<SkillRecord[]>;

  /** 按分类获取技能 */
  getSkillsByCategory(category: string): Promise<SkillRecord[]>;

  // ─────────────────────────────────────────────
  // 签名记录
  // ─────────────────────────────────────────────

  /** 保存签名记录 */
  saveSignature(sig: SignatureRecord): Promise<void>;

  /** 获取签名记录 */
  getSignatures(agentId: string): Promise<SignatureRecord[]>;

  // ─────────────────────────────────────────────
  // 生命周期
  // ─────────────────────────────────────────────

  /** 初始化存储（建表等） */
  initialize(): Promise<void>;

  /** 关闭连接 */
  close(): Promise<void>;

  /** 是否已连接 */
  isConnected(): boolean;
}

/** 技能记录 */
export interface SkillRecord {
  id: string;
  name: string;
  category: string;
  description: string;
  dimension: string;
  maxScore: number;
  checkMethod: string;
  createdAt: string;
}

/** 签名记录 */
export interface SignatureRecord {
  id: string;
  agentId: string;
  recordId: string;
  algorithm: string;
  publicKey: string;
  signature: string;
  dataHash: string;
  verified: boolean;
  createdAt: string;
}
