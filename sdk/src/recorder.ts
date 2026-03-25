/**
 * 龙虾学院 Blackbox SDK — 录制引擎
 * 核心模块：记录Agent的每一次决策
 */

import { randomUUID } from 'crypto';
import { DecisionRecord, ToolCallRecord, RecordType, BlackboxConfig } from './types';
import { Redactor } from './redactor';
import { Signer } from './signer';

export class Recorder {
  private agentId: string;
  private redactor: Redactor;
  private signer: Signer;
  private records: DecisionRecord[] = [];
  private maxRecords: number;
  private maxInputSize: number;

  constructor(config: BlackboxConfig) {
    if (!config.agentId || typeof config.agentId !== 'string' || config.agentId.trim().length === 0) {
      throw new TypeError('agentId is required and must be a non-empty string');
    }
    this.agentId = config.agentId.trim();
    this.redactor = new Redactor(config.redact);
    this.signer = new Signer(config.signingKey);
    this.maxRecords = config.maxRecords ?? 10000;
    this.maxInputSize = config.maxInputSize ?? 262_144; // 256KB（M3: 从 1MB 调小）
  }

  /** 录制一条决策 */
  async record(data: {
    type?: RecordType;
    input: Record<string, unknown>;
    reasoning?: string;
    output: Record<string, unknown>;
    toolCalls?: ToolCallRecord[];
    duration?: number;
    metadata?: Record<string, string>;
  }): Promise<DecisionRecord> {
    // 输入校验
    if (!data || typeof data !== 'object') {
      throw new TypeError('record() requires a data object');
    }
    if (data.input === null || data.input === undefined) {
      throw new TypeError('input is required');
    }
    if (data.output === null || data.output === undefined) {
      throw new TypeError('output is required');
    }
    if (data.type !== undefined && !['decision', 'tool_call', 'error', 'system'].includes(data.type)) {
      throw new TypeError(`Invalid record type: ${data.type}`);
    }
    if (data.duration !== undefined && (typeof data.duration !== 'number' || !Number.isFinite(data.duration) || data.duration < 0)) {
      throw new TypeError('duration must be a finite non-negative number');
    }

    // 记录数上限检查
    if (this.records.length >= this.maxRecords) {
      throw new RangeError(`Max records (${this.maxRecords}) exceeded. Call clear() to free memory.`);
    }

    // 输入大小检查（防DoS）
    const inputSize = JSON.stringify(data.input).length;
    const outputSize = JSON.stringify(data.output).length;
    if (inputSize > this.maxInputSize || outputSize > this.maxInputSize) {
      throw new RangeError(`Input/Output exceeds max size (${this.maxInputSize} chars)`);
    }

    const record: DecisionRecord = {
      id: randomUUID(),
      agentId: this.agentId,
      timestamp: new Date().toISOString(),
      type: data.type ?? 'decision',
      input: this.redactor.redactObject(data.input),
      reasoning: data.reasoning,
      output: this.redactor.redactObject(data.output),
      toolCalls: data.toolCalls?.map(tc => ({
        ...tc,
        params: this.redactor.redactObject(tc.params),
      })),
      duration: data.duration,
      metadata: data.metadata,
    };

    // 计算哈希（确定性序列化，覆盖所有关键字段）
    const hashInput = JSON.stringify({
      id: record.id,
      agentId: record.agentId,
      timestamp: record.timestamp,
      type: record.type,
      input: record.input,
      reasoning: record.reasoning,
      output: record.output,
      toolCalls: record.toolCalls,
      duration: record.duration,
    });
    record.hash = Signer.hash(hashInput);

    // 如果有签名密钥，签名
    if (this.signer.hasKey()) {
      record.signature = this.signer.sign(record.hash);
    }

    this.records.push(record);
    return record;
  }

  /** 批量录制 */
  async recordBatch(items: Array<Parameters<Recorder['record']>[0]>): Promise<DecisionRecord[]> {
    if (!Array.isArray(items)) {
      throw new TypeError('recordBatch() requires an array');
    }
    const results: DecisionRecord[] = [];
    for (const item of items) {
      results.push(await this.record(item));
    }
    return results;
  }

  /** 获取所有记录（返回深拷贝副本） */
  getRecords(): DecisionRecord[] {
    // 使用 JSON 序列化做深拷贝，防外部篡改内部状态
    return JSON.parse(JSON.stringify(this.records));
  }

  /** 按类型筛选 */
  getRecordsByType(type: RecordType): DecisionRecord[] {
    if (!['decision', 'tool_call', 'error', 'system'].includes(type)) {
      throw new TypeError(`Invalid record type: ${type}`);
    }
    return this.records.filter(r => r.type === type);
  }

  /** 清空记录 */
  clear(): void {
    this.records = [];
  }

  /** 获取记录数量 */
  get count(): number {
    return this.records.length;
  }

  /** 获取签名器 */
  getSigner(): Signer {
    return this.signer;
  }

  /** 获取脱敏器 */
  getRedactor(): Redactor {
    return this.redactor;
  }
}
