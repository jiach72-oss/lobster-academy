/**
 * 明镜 Blackbox SDK — S3 存储适配器
 * 支持按 session 归档，JSON/Parquet 格式导出
 */

import {
  DecisionRecord, RecordType,
  Enrollment, EvalRecord, Badge, Certificate,
  AuditReport,
} from '../types';
import { StorageAdapter, SkillRecord, SignatureRecord } from './storage-adapter';

/** S3 存储配置 */
export interface S3StorageConfig {
  /** S3 bucket 名称 */
  bucket: string;
  /** 对象 key 前缀 */
  prefix?: string;
  /** AWS Region */
  region?: string;
  /** 自定义 endpoint (MinIO, LocalStack 等) */
  endpoint?: string;
  /** 访问凭证 */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  /** 导出格式 */
  exportFormat?: 'json' | 'parquet';
}

/** 归档文件信息 */
export interface ArchiveInfo {
  key: string;
  size: number;
  lastModified: string;
  agentId: string;
  sessionId: string;
  eventCount: number;
}

export class S3Storage implements StorageAdapter {
  private client: any;
  private bucket: string;
  private prefix: string;
  private exportFormat: 'json' | 'parquet';
  private buffer: Map<string, DecisionRecord[]> = new Map();
  private _connected = false;

  constructor(config: S3StorageConfig) {
    try {
      const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, HeadBucketCommand } =
        require('@aws-sdk/client-s3');

      this.client = new S3Client({
        region: config.region ?? 'us-east-1',
        endpoint: config.endpoint,
        credentials: config.credentials,
      });

      // Store command classes for later use
      (this as any)._cmds = { PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, HeadBucketCommand };
    } catch {
      throw new Error(
        '@aws-sdk/client-s3 is required for S3 storage. ' +
        'Install it with: npm install @aws-sdk/client-s3'
      );
    }

    this.bucket = config.bucket;
    this.prefix = (config.prefix ?? 'lobster-academy').replace(/\/$/, '');
    this.exportFormat = config.exportFormat ?? 'json';
  }

  private makeKey(agentId: string, sessionId: string = 'default'): string {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const ext = this.exportFormat === 'parquet' ? 'parquet.gz' : 'json.gz';
    return `${this.prefix}/records/${agentId}/${sessionId}/${ts}.${ext}`;
  }

  async initialize(): Promise<void> {
    const { HeadBucketCommand } = (this as any)._cmds;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this._connected = true;
    } catch {
      // Bucket may not exist yet, but we're configured
      this._connected = true;
    }
  }

  // ─────────────────────────────────────────────
  // 录制记录
  // ─────────────────────────────────────────────

  async saveRecord(record: DecisionRecord): Promise<void> {
    const agentId = record.agentId;
    if (!this.buffer.has(agentId)) {
      this.buffer.set(agentId, []);
    }
    this.buffer.get(agentId)!.push(record);
  }

  async saveRecords(records: DecisionRecord[]): Promise<void> {
    for (const record of records) {
      await this.saveRecord(record);
    }
  }

  /** 将缓冲区数据归档到 S3 */
  async archiveSession(agentId: string, sessionId: string = 'default'): Promise<string> {
    const records = this.buffer.get(agentId) ?? [];
    if (records.length === 0) {
      throw new Error(`No records to archive for agent ${agentId}`);
    }

    const key = this.makeKey(agentId, sessionId);
    const body = Buffer.from(JSON.stringify(records));

    // Compress with gzip
    const zlib = require('zlib');
    const compressed = zlib.gzipSync(body);

    const { PutObjectCommand } = (this as any)._cmds;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: compressed,
      ContentEncoding: 'gzip',
      ContentType: 'application/json',
      Metadata: {
        agentId,
        sessionId,
        recordCount: String(records.length),
        format: this.exportFormat,
      },
    }));

    // Clear buffer
    this.buffer.delete(agentId);

    return key;
  }

  async getRecords(agentId?: string): Promise<DecisionRecord[]> {
    // Read from buffer
    if (agentId) {
      return [...(this.buffer.get(agentId) ?? [])];
    }

    // Read all buffered records
    const all: DecisionRecord[] = [];
    for (const records of this.buffer.values()) {
      all.push(...records);
    }
    return all;
  }

  /** 从 S3 读取归档的记录 */
  async getArchivedRecords(agentId: string): Promise<DecisionRecord[]> {
    const { ListObjectsV2Command, GetObjectCommand } = (this as any)._cmds;
    const prefix = `${this.prefix}/records/${agentId}/`;
    const records: DecisionRecord[] = [];

    let continuationToken: string | undefined;
    do {
      const listResult = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }));

      for (const obj of listResult.Contents ?? []) {
        try {
          const result = await this.client.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: obj.Key,
          }));

          const zlib = require('zlib');
          const chunks: Buffer[] = [];
          for await (const chunk of result.Body) {
            chunks.push(Buffer.from(chunk));
          }
          const compressed = Buffer.concat(chunks);
          const decompressed = zlib.gunzipSync(compressed);
          const data = JSON.parse(decompressed.toString());

          if (Array.isArray(data)) {
            records.push(...data);
          }
        } catch (e) {
          console.warn(`Failed to read archived object ${obj.Key}:`, e);
        }
      }

      continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);

    return records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
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
      this.buffer.delete(agentId);

      // Also delete archived objects
      const { ListObjectsV2Command, DeleteObjectsCommand } = (this as any)._cmds;
      const prefix = `${this.prefix}/records/${agentId}/`;

      let continuationToken: string | undefined;
      do {
        const listResult = await this.client.send(new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }));

        const objects = (listResult.Contents ?? []).map((o: any) => ({ Key: o.Key }));
        if (objects.length > 0) {
          await this.client.send(new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: objects },
          }));
        }

        continuationToken = listResult.NextContinuationToken;
      } while (continuationToken);
    } else {
      this.buffer.clear();
    }
  }

  async countRecords(agentId?: string): Promise<number> {
    if (agentId) {
      return (this.buffer.get(agentId) ?? []).length;
    }
    let total = 0;
    for (const records of this.buffer.values()) {
      total += records.length;
    }
    return total;
  }

  /** 列出所有归档文件 */
  async listArchives(agentId?: string): Promise<ArchiveInfo[]> {
    const { ListObjectsV2Command } = (this as any)._cmds;
    const prefix = agentId
      ? `${this.prefix}/records/${agentId}/`
      : `${this.prefix}/records/`;

    const archives: ArchiveInfo[] = [];
    let continuationToken: string | undefined;

    do {
      const result = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }));

      for (const obj of result.Contents ?? []) {
        const parts = obj.Key?.split('/') ?? [];
        archives.push({
          key: obj.Key!,
          size: obj.Size ?? 0,
          lastModified: obj.LastModified?.toISOString() ?? '',
          agentId: parts[2] ?? '',
          sessionId: parts[3] ?? '',
          eventCount: 0, // Would need to read metadata
        });
      }

      continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    return archives;
  }

  // ─────────────────────────────────────────────
  // 入学信息
  // ─────────────────────────────────────────────

  async saveEnrollment(enrollment: Enrollment): Promise<void> {
    const { PutObjectCommand } = (this as any)._cmds;
    const key = `${this.prefix}/enrollments/${enrollment.agentId}.json`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(enrollment),
      ContentType: 'application/json',
    }));
  }

  async getEnrollment(agentId: string): Promise<Enrollment | null> {
    const { GetObjectCommand } = (this as any)._cmds;
    const key = `${this.prefix}/enrollments/${agentId}.json`;
    try {
      const result = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      const chunks: Buffer[] = [];
      for await (const chunk of result.Body) {
        chunks.push(Buffer.from(chunk));
      }
      return JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────
  // 评测记录
  // ─────────────────────────────────────────────

  async saveEval(agentId: string, evalRecord: EvalRecord): Promise<void> {
    const { PutObjectCommand } = (this as any)._cmds;
    const key = `${this.prefix}/evals/${agentId}/${evalRecord.sequence}.json`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(evalRecord),
      ContentType: 'application/json',
    }));
  }

  async getEvalHistory(agentId: string): Promise<EvalRecord[]> {
    const { ListObjectsV2Command, GetObjectCommand } = (this as any)._cmds;
    const prefix = `${this.prefix}/evals/${agentId}/`;

    const result = await this.client.send(new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
    }));

    const evals: EvalRecord[] = [];
    for (const obj of result.Contents ?? []) {
      try {
        const r = await this.client.send(new GetObjectCommand({
          Bucket: this.bucket,
          Key: obj.Key,
        }));
        const chunks: Buffer[] = [];
        for await (const chunk of r.Body) {
          chunks.push(Buffer.from(chunk));
        }
        evals.push(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {}
    }

    return evals.sort((a, b) => a.sequence - b.sequence);
  }

  // ─────────────────────────────────────────────
  // 徽章
  // ─────────────────────────────────────────────

  async saveBadges(agentId: string, badges: Badge[]): Promise<void> {
    const { PutObjectCommand } = (this as any)._cmds;
    const key = `${this.prefix}/badges/${agentId}.json`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(badges),
      ContentType: 'application/json',
    }));
  }

  async getBadges(agentId: string): Promise<Badge[]> {
    const { GetObjectCommand } = (this as any)._cmds;
    const key = `${this.prefix}/badges/${agentId}.json`;
    try {
      const result = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      const chunks: Buffer[] = [];
      for await (const chunk of result.Body) {
        chunks.push(Buffer.from(chunk));
      }
      return JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      return [];
    }
  }

  // ─────────────────────────────────────────────
  // 证书
  // ─────────────────────────────────────────────

  async saveCertificate(cert: Certificate): Promise<void> {
    const { PutObjectCommand } = (this as any)._cmds;
    const key = `${this.prefix}/certificates/${cert.agentId}/${cert.agentId}.json`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(cert),
      ContentType: 'application/json',
    }));
  }

  async getCertificates(agentId: string): Promise<Certificate[]> {
    const { ListObjectsV2Command, GetObjectCommand } = (this as any)._cmds;
    const prefix = `${this.prefix}/certificates/${agentId}/`;

    const result = await this.client.send(new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
    }));

    const certs: Certificate[] = [];
    for (const obj of result.Contents ?? []) {
      try {
        const r = await this.client.send(new GetObjectCommand({
          Bucket: this.bucket,
          Key: obj.Key,
        }));
        const chunks: Buffer[] = [];
        for await (const chunk of r.Body) {
          chunks.push(Buffer.from(chunk));
        }
        certs.push(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {}
    }

    return certs;
  }

  // ─────────────────────────────────────────────
  // 报告
  // ─────────────────────────────────────────────

  async saveReport(report: AuditReport): Promise<void> {
    const { PutObjectCommand } = (this as any)._cmds;
    const key = `${this.prefix}/reports/${report.agentId}/${report.agentId}.json`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(report),
      ContentType: 'application/json',
    }));
  }

  async getReports(agentId: string): Promise<AuditReport[]> {
    const { ListObjectsV2Command, GetObjectCommand } = (this as any)._cmds;
    const prefix = `${this.prefix}/reports/${agentId}/`;

    const result = await this.client.send(new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
    }));

    const reports: AuditReport[] = [];
    for (const obj of result.Contents ?? []) {
      try {
        const r = await this.client.send(new GetObjectCommand({
          Bucket: this.bucket,
          Key: obj.Key,
        }));
        const chunks: Buffer[] = [];
        for await (const chunk of r.Body) {
          chunks.push(Buffer.from(chunk));
        }
        reports.push(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {}
    }

    return reports;
  }

  // ─────────────────────────────────────────────
  // 技能库
  // ─────────────────────────────────────────────

  async saveSkill(skill: SkillRecord): Promise<void> {
    const { PutObjectCommand } = (this as any)._cmds;
    const key = `${this.prefix}/skills/${skill.id}.json`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(skill),
      ContentType: 'application/json',
    }));
  }

  async getSkills(): Promise<SkillRecord[]> {
    const { ListObjectsV2Command, GetObjectCommand } = (this as any)._cmds;
    const prefix = `${this.prefix}/skills/`;

    const result = await this.client.send(new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
    }));

    const skills: SkillRecord[] = [];
    for (const obj of result.Contents ?? []) {
      try {
        const r = await this.client.send(new GetObjectCommand({
          Bucket: this.bucket,
          Key: obj.Key,
        }));
        const chunks: Buffer[] = [];
        for await (const chunk of r.Body) {
          chunks.push(Buffer.from(chunk));
        }
        skills.push(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {}
    }

    return skills;
  }

  async getSkillsByCategory(category: string): Promise<SkillRecord[]> {
    const skills = await this.getSkills();
    return skills.filter(s => s.category === category);
  }

  // ─────────────────────────────────────────────
  // 签名记录
  // ─────────────────────────────────────────────

  async saveSignature(sig: SignatureRecord): Promise<void> {
    const { PutObjectCommand } = (this as any)._cmds;
    const key = `${this.prefix}/signatures/${sig.agentId}/${sig.id}.json`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(sig),
      ContentType: 'application/json',
    }));
  }

  async getSignatures(agentId: string): Promise<SignatureRecord[]> {
    const { ListObjectsV2Command, GetObjectCommand } = (this as any)._cmds;
    const prefix = `${this.prefix}/signatures/${agentId}/`;

    const result = await this.client.send(new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
    }));

    const sigs: SignatureRecord[] = [];
    for (const obj of result.Contents ?? []) {
      try {
        const r = await this.client.send(new GetObjectCommand({
          Bucket: this.bucket,
          Key: obj.Key,
        }));
        const chunks: Buffer[] = [];
        for await (const chunk of r.Body) {
          chunks.push(Buffer.from(chunk));
        }
        sigs.push(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {}
    }

    return sigs;
  }

  // ─────────────────────────────────────────────
  // 生命周期
  // ─────────────────────────────────────────────

  async close(): Promise<void> {
    this.client.destroy();
    this._connected = false;
  }

  isConnected(): boolean {
    return this._connected;
  }
}
