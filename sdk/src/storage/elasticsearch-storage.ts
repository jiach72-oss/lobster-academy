/**
 * 明镜 Blackbox SDK — Elasticsearch 存储适配器
 * 支持全文搜索、时间范围查询、批量写入
 */

import {
  DecisionRecord, RecordType,
  Enrollment, EvalRecord, Badge, Certificate,
  AuditReport,
} from '../types';
import { StorageAdapter, SkillRecord, SignatureRecord } from './storage-adapter';

/** Elasticsearch 存储配置 */
export interface ElasticsearchStorageConfig {
  /** ES 节点地址 */
  node: string | string[];
  /** 索引前缀 */
  indexPrefix?: string;
  /** 认证信息 */
  auth?: { username: string; password: string };
  /** API Key 认证 */
  apiKey?: string;
  /** 批量写入缓冲大小 */
  bulkSize?: number;
  /** 请求超时(ms) */
  requestTimeout?: number;
}

/** 搜索选项 */
export interface SearchOptions {
  agentId?: string;
  type?: RecordType;
  from?: string;
  to?: string;
  size?: number;
}

export class ElasticsearchStorage implements StorageAdapter {
  private client: any;
  private indexPrefix: string;
  private bulkSize: number;
  private buffer: any[] = [];
  private _connected = false;

  constructor(config: ElasticsearchStorageConfig) {
    try {
      // Dynamic import to avoid hard dependency
      const { Client } = require('@elastic/elasticsearch');
      this.client = new Client({
        nodes: Array.isArray(config.node) ? config.node : [config.node],
        auth: config.auth,
        apiKey: config.apiKey,
        requestTimeout: config.requestTimeout ?? 30000,
      });
    } catch {
      throw new Error(
        '@elastic/elasticsearch is required for Elasticsearch storage. ' +
        'Install it with: npm install @elastic/elasticsearch'
      );
    }

    this.indexPrefix = config.indexPrefix ?? 'lobster-academy';
    this.bulkSize = config.bulkSize ?? 100;
  }

  private getIndexName(entity: string = 'records'): string {
    return `${this.indexPrefix}-${entity}`;
  }

  private getDateIndex(entity: string = 'records'): string {
    const month = new Date().toISOString().slice(0, 7).replace('-', '.');
    return `${this.indexPrefix}-${entity}-${month}`;
  }

  async initialize(): Promise<void> {
    // Create indices with mappings
    const indices = [
      {
        index: this.getIndexName('records'),
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              agentId: { type: 'keyword' },
              timestamp: { type: 'date' },
              type: { type: 'keyword' },
              input: { type: 'text', analyzer: 'standard' },
              reasoning: { type: 'text', analyzer: 'standard' },
              output: { type: 'text', analyzer: 'standard' },
              toolCalls: { type: 'nested' },
              duration: { type: 'float' },
              signature: { type: 'keyword' },
              hash: { type: 'keyword' },
            },
          },
          settings: { number_of_shards: 1, number_of_replicas: 0 },
        },
      },
      {
        index: this.getIndexName('enrollments'),
        body: {
          mappings: {
            properties: {
              studentId: { type: 'keyword' },
              agentId: { type: 'keyword' },
              enrolledAt: { type: 'date' },
              department: { type: 'keyword' },
              advisor: { type: 'keyword' },
              currentGrade: { type: 'keyword' },
            },
          },
        },
      },
      {
        index: this.getIndexName('evals'),
        body: {
          mappings: {
            properties: {
              agentId: { type: 'keyword' },
              sequence: { type: 'integer' },
              timestamp: { type: 'date' },
              totalScore: { type: 'float' },
              grade: { type: 'keyword' },
              dimensions: { type: 'object' },
            },
          },
        },
      },
    ];

    for (const { index, body } of indices) {
      const exists = await this.client.indices.exists({ index });
      if (!exists) {
        await this.client.indices.create({ index, body });
      }
    }

    this._connected = true;
  }

  // ─────────────────────────────────────────────
  // 录制记录
  // ─────────────────────────────────────────────

  async saveRecord(record: DecisionRecord): Promise<void> {
    await this.client.index({
      index: this.getIndexName('records'),
      id: record.id,
      document: record,
      refresh: false,
    });
  }

  async saveRecords(records: DecisionRecord[]): Promise<void> {
    if (records.length === 0) return;

    const operations = records.flatMap((record) => [
      { index: { _index: this.getIndexName('records'), _id: record.id } },
      record,
    ]);

    const result = await this.client.bulk({ operations, refresh: false });
    if (result.errors) {
      const failed = result.items.filter((i: any) => i.index?.error);
      console.error(`Bulk insert had ${failed.length} errors`);
    }
  }

  async getRecords(agentId?: string): Promise<DecisionRecord[]> {
    const query = agentId
      ? { query: { term: { agentId } } }
      : { query: { match_all: {} } };

    const result = await this.client.search({
      index: this.getIndexName('records'),
      body: { ...query, sort: [{ timestamp: { order: 'asc' } }], size: 10000 },
    });

    return result.hits.hits.map((hit: any) => hit._source);
  }

  async getRecordsByType(type: RecordType, agentId?: string): Promise<DecisionRecord[]> {
    const must: any[] = [{ term: { type } }];
    if (agentId) must.push({ term: { agentId } });

    const result = await this.client.search({
      index: this.getIndexName('records'),
      body: {
        query: { bool: { must } },
        sort: [{ timestamp: { order: 'asc' } }],
        size: 10000,
      },
    });

    return result.hits.hits.map((hit: any) => hit._source);
  }

  async getRecordsByPeriod(agentId: string, from?: string, to?: string): Promise<DecisionRecord[]> {
    const must: any[] = [{ term: { agentId } }];
    if (from || to) {
      const range: any = {};
      if (from) range.gte = from;
      if (to) range.lte = to;
      must.push({ range: { timestamp: range } });
    }

    const result = await this.client.search({
      index: this.getIndexName('records'),
      body: {
        query: { bool: { must } },
        sort: [{ timestamp: { order: 'asc' } }],
        size: 10000,
      },
    });

    return result.hits.hits.map((hit: any) => hit._source);
  }

  async clearRecords(agentId?: string): Promise<void> {
    if (!agentId) {
      throw new Error('clearRecords requires an agentId to prevent accidental full-table deletion');
    }

    await this.client.deleteByQuery({
      index: this.getIndexName('records'),
      body: { query: { term: { agentId } } },
      conflicts: 'proceed',
    });
  }

  async countRecords(agentId?: string): Promise<number> {
    const query = agentId
      ? { query: { term: { agentId } } }
      : { query: { match_all: {} } };

    const result = await this.client.count({
      index: this.getIndexName('records'),
      body: query,
    });

    return result.count;
  }

  // ─────────────────────────────────────────────
  // 全文搜索（ES 特有功能）
  // ─────────────────────────────────────────────

  async search(queryText: string, options?: SearchOptions): Promise<DecisionRecord[]> {
    const must: any[] = [
      {
        multi_match: {
          query: queryText,
          fields: ['input^2', 'reasoning', 'output'],
          type: 'best_fields',
        },
      },
    ];

    if (options?.agentId) must.push({ term: { agentId: options.agentId } });
    if (options?.type) must.push({ term: { type: options.type } });
    if (options?.from || options?.to) {
      const range: any = {};
      if (options.from) range.gte = options.from;
      if (options.to) range.lte = options.to;
      must.push({ range: { timestamp: range } });
    }

    const result = await this.client.search({
      index: this.getIndexName('records'),
      body: {
        query: { bool: { must } },
        sort: [{ _score: { order: 'desc' } }],
        size: options?.size ?? 20,
      },
    });

    return result.hits.hits.map((hit: any) => hit._source);
  }

  // ─────────────────────────────────────────────
  // 入学信息
  // ─────────────────────────────────────────────

  async saveEnrollment(enrollment: Enrollment): Promise<void> {
    await this.client.index({
      index: this.getIndexName('enrollments'),
      id: enrollment.studentId,
      document: enrollment,
      refresh: true,
    });
  }

  async getEnrollment(agentId: string): Promise<Enrollment | null> {
    const result = await this.client.search({
      index: this.getIndexName('enrollments'),
      body: { query: { term: { agentId } }, size: 1 },
    });

    return result.hits.hits[0]?._source ?? null;
  }

  // ─────────────────────────────────────────────
  // 评测记录
  // ─────────────────────────────────────────────

  async saveEval(agentId: string, evalRecord: EvalRecord): Promise<void> {
    await this.client.index({
      index: this.getIndexName('evals'),
      document: { ...evalRecord, agentId },
      refresh: false,
    });
  }

  async getEvalHistory(agentId: string): Promise<EvalRecord[]> {
    const result = await this.client.search({
      index: this.getIndexName('evals'),
      body: {
        query: { term: { agentId } },
        sort: [{ sequence: { order: 'asc' } }],
        size: 1000,
      },
    });

    return result.hits.hits.map((hit: any) => {
      const { agentId: _, ...evalRec } = hit._source;
      return evalRec;
    });
  }

  // ─────────────────────────────────────────────
  // 徽章
  // ─────────────────────────────────────────────

  async saveBadges(agentId: string, badges: Badge[]): Promise<void> {
    await this.client.index({
      index: this.getIndexName('badges'),
      id: agentId,
      document: { agentId, badges },
      refresh: true,
    });
  }

  async getBadges(agentId: string): Promise<Badge[]> {
    try {
      const result = await this.client.get({
        index: this.getIndexName('badges'),
        id: agentId,
      });
      return result._source?.badges ?? [];
    } catch (e: any) {
      if (e.meta?.statusCode === 404) return [];
      throw e;
    }
  }

  // ─────────────────────────────────────────────
  // 证书
  // ─────────────────────────────────────────────

  async saveCertificate(cert: Certificate): Promise<void> {
    await this.client.index({
      index: this.getIndexName('certificates'),
      document: cert,
      refresh: false,
    });
  }

  async getCertificates(agentId: string): Promise<Certificate[]> {
    const result = await this.client.search({
      index: this.getIndexName('certificates'),
      body: { query: { term: { agentId } }, size: 100 },
    });

    return result.hits.hits.map((hit: any) => hit._source);
  }

  // ─────────────────────────────────────────────
  // 报告
  // ─────────────────────────────────────────────

  async saveReport(report: AuditReport): Promise<void> {
    await this.client.index({
      index: this.getIndexName('reports'),
      document: report,
      refresh: false,
    });
  }

  async getReports(agentId: string): Promise<AuditReport[]> {
    const result = await this.client.search({
      index: this.getIndexName('reports'),
      body: {
        query: { term: { agentId } },
        sort: [{ 'metadata.timestamp': { order: 'desc' } }],
        size: 100,
      },
    });

    return result.hits.hits.map((hit: any) => hit._source);
  }

  // ─────────────────────────────────────────────
  // 技能库
  // ─────────────────────────────────────────────

  async saveSkill(skill: SkillRecord): Promise<void> {
    await this.client.index({
      index: this.getIndexName('skills'),
      id: skill.id,
      document: skill,
      refresh: true,
    });
  }

  async getSkills(): Promise<SkillRecord[]> {
    const result = await this.client.search({
      index: this.getIndexName('skills'),
      body: { query: { match_all: {} }, size: 1000 },
    });

    return result.hits.hits.map((hit: any) => hit._source);
  }

  async getSkillsByCategory(category: string): Promise<SkillRecord[]> {
    const result = await this.client.search({
      index: this.getIndexName('skills'),
      body: { query: { term: { category } }, size: 1000 },
    });

    return result.hits.hits.map((hit: any) => hit._source);
  }

  // ─────────────────────────────────────────────
  // 签名记录
  // ─────────────────────────────────────────────

  async saveSignature(sig: SignatureRecord): Promise<void> {
    await this.client.index({
      index: this.getIndexName('signatures'),
      document: sig,
      refresh: false,
    });
  }

  async getSignatures(agentId: string): Promise<SignatureRecord[]> {
    const result = await this.client.search({
      index: this.getIndexName('signatures'),
      body: { query: { term: { agentId } }, size: 10000 },
    });

    return result.hits.hits.map((hit: any) => hit._source);
  }

  // ─────────────────────────────────────────────
  // 生命周期
  // ─────────────────────────────────────────────

  async close(): Promise<void> {
    await this.client.close();
    this._connected = false;
  }

  isConnected(): boolean {
    return this._connected;
  }
}
