/**
 * 明镜 Blackbox SDK — PostgreSQL 存储实现
 * 基于 Drizzle ORM + pg 连接池
 */

import { Pool, PoolConfig } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc, count, inArray, sql } from 'drizzle-orm';
import {
  DecisionRecord, RecordType,
  Enrollment, EvalRecord, Badge, Certificate,
  AuditReport,
} from '../types';
import { StorageAdapter, SkillRecord, SignatureRecord } from './storage-adapter';
import * as schema from './pg-schema';

/** PostgreSQL 存储配置 */
export interface PgStorageConfig {
  /** 数据库连接字符串 */
  connectionString?: string;
  /** 连接池配置 */
  pool?: PoolConfig;
  /** 最大连接数 */
  max?: number;
  /** 连接超时(ms) */
  connectionTimeoutMillis?: number;
  /** 空闲超时(ms) */
  idleTimeoutMillis?: number;
}

export class PgStorage implements StorageAdapter {
  private pool: Pool;
  private db: NodePgDatabase<typeof schema>;
  private _connected = false;

  constructor(config?: PgStorageConfig) {
    const connectionString = config?.connectionString ?? process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable or connectionString config is required');
    }

    this.pool = new Pool({
      connectionString,
      max: config?.max ?? config?.pool?.max ?? 20,
      connectionTimeoutMillis: config?.connectionTimeoutMillis ?? 5000,
      idleTimeoutMillis: config?.idleTimeoutMillis ?? 30000,
      ...config?.pool,
    });

    this.db = drizzle(this.pool, { schema });
  }

  // ─────────────────────────────────────────────
  // 录制记录
  // ─────────────────────────────────────────────

  async saveRecord(record: DecisionRecord): Promise<void> {
    await this.db.insert(schema.recordings).values({
      id: record.id,
      agentId: record.agentId,
      timestamp: new Date(record.timestamp),
      type: record.type,
      input: record.input,
      reasoning: record.reasoning ?? null,
      output: record.output,
      toolCalls: record.toolCalls ?? [],
      duration: record.duration ?? null,
      signature: record.signature ?? null,
      hash: record.hash ?? null,
      metadata: record.metadata ?? {},
    });
  }

  async saveRecords(records: DecisionRecord[]): Promise<void> {
    if (records.length === 0) return;

    // 批量插入，分批处理避免过大事务，全部包裹在单个事务中保证原子性
    const BATCH_SIZE = 100;
    const batches: DecisionRecord[][] = [];
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      batches.push(records.slice(i, i + BATCH_SIZE));
    }

    await this.db.transaction(async (tx) => {
      for (const batch of batches) {
        await tx.insert(schema.recordings).values(
          batch.map(r => ({
            id: r.id,
            agentId: r.agentId,
            timestamp: new Date(r.timestamp),
            type: r.type,
            input: r.input,
            reasoning: r.reasoning ?? null,
            output: r.output,
            toolCalls: r.toolCalls ?? [],
            duration: r.duration ?? null,
            signature: r.signature ?? null,
            hash: r.hash ?? null,
            metadata: r.metadata ?? {},
          }))
        );
      }
    });
  }

  async getRecords(agentId?: string): Promise<DecisionRecord[]> {
    const query = agentId
      ? this.db.select().from(schema.recordings).where(eq(schema.recordings.agentId, agentId)).orderBy(desc(schema.recordings.timestamp))
      : this.db.select().from(schema.recordings).orderBy(desc(schema.recordings.timestamp));

    const rows = await query;
    return rows.map(this.rowToRecord);
  }

  async getRecordsByType(type: RecordType, agentId?: string): Promise<DecisionRecord[]> {
    const conditions = [eq(schema.recordings.type, type)];
    if (agentId) {
      conditions.push(eq(schema.recordings.agentId, agentId));
    }

    const rows = await this.db
      .select()
      .from(schema.recordings)
      .where(and(...conditions))
      .orderBy(desc(schema.recordings.timestamp));

    return rows.map(this.rowToRecord);
  }

  async getRecordsByPeriod(agentId: string, from?: string, to?: string): Promise<DecisionRecord[]> {
    const conditions = [eq(schema.recordings.agentId, agentId)];
    if (from) conditions.push(gte(schema.recordings.timestamp, new Date(from)));
    if (to) conditions.push(lte(schema.recordings.timestamp, new Date(to)));

    const rows = await this.db
      .select()
      .from(schema.recordings)
      .where(and(...conditions))
      .orderBy(desc(schema.recordings.timestamp));

    return rows.map(this.rowToRecord);
  }

  async clearRecords(agentId?: string): Promise<void> {
    if (!agentId) {
      throw new Error('clearRecords requires an agentId to prevent accidental full-table deletion');
    }
    await this.db.delete(schema.recordings).where(eq(schema.recordings.agentId, agentId));
  }

  async countRecords(agentId?: string): Promise<number> {
    const query = agentId
      ? this.db.select({ count: count() }).from(schema.recordings).where(eq(schema.recordings.agentId, agentId))
      : this.db.select({ count: count() }).from(schema.recordings);

    const [result] = await query;
    return result?.count ?? 0;
  }

  // ─────────────────────────────────────────────
  // 入学信息
  // ─────────────────────────────────────────────

  async saveEnrollment(enrollment: Enrollment): Promise<void> {
    const metadataValue = {
      studentId: enrollment.studentId,
      enrolledAt: enrollment.enrolledAt,
      advisor: enrollment.advisor,
      initialScore: enrollment.initialScore,
      currentGrade: enrollment.currentGrade,
    };

    // 使用 upsert 避免 TOCTOU 竞态
    await this.db
      .insert(schema.agents)
      .values({
        agentId: enrollment.agentId,
        department: enrollment.department,
        metadata: metadataValue,
      })
      .onConflictDoUpdate({
        target: schema.agents.agentId,
        set: {
          department: enrollment.department,
          metadata: metadataValue,
          updatedAt: new Date(),
        },
      });
  }

  async getEnrollment(agentId: string): Promise<Enrollment | null> {
    const [row] = await this.db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.agentId, agentId))
      .limit(1);

    if (!row || !row.metadata) return null;

    const meta = row.metadata as Record<string, unknown>;
    if (!meta.studentId) return null;

    return {
      studentId: meta.studentId as string,
      agentId: row.agentId,
      enrolledAt: meta.enrolledAt as string,
      department: row.department ?? 'general',
      advisor: (meta.advisor as string) ?? '明镜自动评测系统',
      initialScore: meta.initialScore as number | undefined,
      currentGrade: (meta.currentGrade as string ?? 'D') as Enrollment['currentGrade'],
    };
  }

  // ─────────────────────────────────────────────
  // 评测记录
  // ─────────────────────────────────────────────

  async saveEval(agentId: string, evalRecord: EvalRecord): Promise<void> {
    await this.db.insert(schema.evaluations).values({
      agentId,
      sequence: evalRecord.sequence,
      timestamp: new Date(evalRecord.timestamp),
      dimensions: evalRecord.dimensions,
      totalScore: evalRecord.totalScore,
      grade: evalRecord.grade,
      agentVersion: evalRecord.agentVersion ?? null,
    });
  }

  async getEvalHistory(agentId: string): Promise<EvalRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.evaluations)
      .where(eq(schema.evaluations.agentId, agentId))
      .orderBy(schema.evaluations.sequence);

    return rows.map(row => ({
      sequence: row.sequence,
      timestamp: row.timestamp.toISOString(),
      dimensions: row.dimensions as EvalRecord['dimensions'],
      totalScore: row.totalScore,
      grade: row.grade as EvalRecord['grade'],
      agentVersion: row.agentVersion ?? undefined,
    }));
  }

  // ─────────────────────────────────────────────
  // 徽章（暂存于 agents.metadata 或单独处理）
  // ─────────────────────────────────────────────

  async saveBadges(agentId: string, badgeList: Badge[]): Promise<void> {
    // 使用 SELECT FOR UPDATE 防止 Lost Update
    await this.db.transaction(async (tx) => {
      // 先加行锁
      await tx.execute(sql`SELECT agent_id FROM agents WHERE agent_id = ${agentId} FOR UPDATE`);

      const [agent] = await tx
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.agentId, agentId))
        .limit(1);

      if (agent) {
        const meta = (agent.metadata as Record<string, unknown>) ?? {};
        meta.badges = badgeList;
        await tx
          .update(schema.agents)
          .set({ metadata: meta, updatedAt: new Date() })
          .where(eq(schema.agents.agentId, agentId));
      }
    });
  }

  async getBadges(agentId: string): Promise<Badge[]> {
    const [agent] = await this.db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.agentId, agentId))
      .limit(1);

    if (!agent?.metadata) return [];
    const meta = agent.metadata as Record<string, unknown>;
    return (meta.badges as Badge[]) ?? [];
  }

  // ─────────────────────────────────────────────
  // 证书
  // ─────────────────────────────────────────────

  async saveCertificate(cert: Certificate): Promise<void> {
    // 使用 SELECT FOR UPDATE 防止 Lost Update
    await this.db.transaction(async (tx) => {
      // 先加行锁
      await tx.execute(sql`SELECT agent_id FROM agents WHERE agent_id = ${cert.agentId} FOR UPDATE`);

      const [agent] = await tx
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.agentId, cert.agentId))
        .limit(1);

      if (agent) {
        const meta = (agent.metadata as Record<string, unknown>) ?? {};
        const certs = (meta.certificates as Certificate[]) ?? [];
        certs.push(cert);
        meta.certificates = certs;
        await tx
          .update(schema.agents)
          .set({ metadata: meta, updatedAt: new Date() })
          .where(eq(schema.agents.agentId, cert.agentId));
      }
    });
  }

  async getCertificates(agentId: string): Promise<Certificate[]> {
    const [agent] = await this.db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.agentId, agentId))
      .limit(1);

    if (!agent?.metadata) return [];
    const meta = agent.metadata as Record<string, unknown>;
    return (meta.certificates as Certificate[]) ?? [];
  }

  // ─────────────────────────────────────────────
  // 报告
  // ─────────────────────────────────────────────

  async saveReport(report: AuditReport): Promise<void> {
    await this.db.insert(schema.reports).values({
      id: report.id,
      agentId: report.agentId,
      periodFrom: new Date(report.period.from),
      periodTo: new Date(report.period.to),
      summary: report.summary,
      anomalies: report.anomalies,
      signature: report.signature ?? null,
      generatedAt: new Date(report.generatedAt),
    });
  }

  async getReports(agentId: string): Promise<AuditReport[]> {
    const rows = await this.db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.agentId, agentId))
      .orderBy(desc(schema.reports.generatedAt));

    return rows.map(row => ({
      id: row.id,
      agentId: row.agentId,
      period: {
        from: row.periodFrom.toISOString(),
        to: row.periodTo.toISOString(),
      },
      summary: row.summary as AuditReport['summary'],
      records: [], // 报告中的 records 需要从 recordings 表单独查询
      anomalies: row.anomalies as AuditReport['anomalies'],
      signature: row.signature ?? undefined,
      generatedAt: row.generatedAt.toISOString(),
    }));
  }

  // ─────────────────────────────────────────────
  // 技能库
  // ─────────────────────────────────────────────

  async saveSkill(skill: SkillRecord): Promise<void> {
    await this.db
      .insert(schema.skills)
      .values({
        id: skill.id,
        name: skill.name,
        category: skill.category,
        description: skill.description,
        dimension: skill.dimension,
        maxScore: skill.maxScore,
        checkMethod: skill.checkMethod,
      })
      .onConflictDoUpdate({
        target: schema.skills.id,
        set: {
          name: skill.name,
          category: skill.category,
          description: skill.description,
          dimension: skill.dimension,
          maxScore: skill.maxScore,
          checkMethod: skill.checkMethod,
        },
      });
  }

  async getSkills(): Promise<SkillRecord[]> {
    const rows = await this.db.select().from(schema.skills);
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      dimension: row.dimension,
      maxScore: row.maxScore,
      checkMethod: row.checkMethod,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getSkillsByCategory(category: string): Promise<SkillRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.skills)
      .where(eq(schema.skills.category, category));

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      dimension: row.dimension,
      maxScore: row.maxScore,
      checkMethod: row.checkMethod,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  // ─────────────────────────────────────────────
  // 签名记录
  // ─────────────────────────────────────────────

  async saveSignature(sig: SignatureRecord): Promise<void> {
    await this.db.insert(schema.signatures).values({
      agentId: sig.agentId,
      recordId: sig.recordId,
      algorithm: sig.algorithm,
      publicKey: sig.publicKey,
      signature: sig.signature,
      dataHash: sig.dataHash,
      verified: sig.verified,
    });
  }

  async getSignatures(agentId: string): Promise<SignatureRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.signatures)
      .where(eq(schema.signatures.agentId, agentId));

    return rows.map(row => ({
      id: row.id,
      agentId: row.agentId,
      recordId: row.recordId,
      algorithm: row.algorithm,
      publicKey: row.publicKey,
      signature: row.signature,
      dataHash: row.dataHash,
      verified: row.verified ?? false,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  // ─────────────────────────────────────────────
  // 生命周期
  // ─────────────────────────────────────────────

  async initialize(): Promise<void> {
    // 测试连接
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
      this._connected = true;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    this._connected = false;
  }

  isConnected(): boolean {
    return this._connected;
  }

  // ─────────────────────────────────────────────
  // 内部工具方法
  // ─────────────────────────────────────────────

  private rowToRecord(row: typeof schema.recordings.$inferSelect): DecisionRecord {
    return {
      id: row.id,
      agentId: row.agentId,
      timestamp: row.timestamp.toISOString(),
      type: row.type as RecordType,
      input: row.input as Record<string, unknown>,
      reasoning: row.reasoning ?? undefined,
      output: row.output as Record<string, unknown>,
      toolCalls: (row.toolCalls as DecisionRecord['toolCalls']) ?? undefined,
      duration: row.duration ?? undefined,
      signature: row.signature ?? undefined,
      hash: row.hash ?? undefined,
      metadata: (row.metadata as Record<string, string>) ?? undefined,
    };
  }
}
