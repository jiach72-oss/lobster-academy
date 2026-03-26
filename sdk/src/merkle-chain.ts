/**
 * 龙虾学院 Blackbox SDK — Merkle 哈希链模块
 * 
 * 事件哈希链实现，确保事件序列不可篡改：
 *   Event₁ → hash₁ = SHA256(event₁.data)
 *   Event₂ → hash₂ = SHA256(event₂.data + hash₁)
 *   Event₃ → hash₃ = SHA256(event₃.data + hash₂)
 * 
 * 特性：
 * - 每个事件携带 prev_hash 字段
 * - 链完整性验证方法
 * - 篡改检测（标记从异常事件起为 tampered）
 */

import { createHash } from 'crypto';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 哈希链事件 */
export interface ChainedEvent<T = Record<string, unknown>> {
  /** 事件唯一 ID */
  id: string;
  /** 事件数据 */
  data: T;
  /** 事件时间戳 ISO8601 */
  timestamp: string;
  /** 前一事件的哈希（链头为 null） */
  prevHash: string | null;
  /** 当前事件的哈希 */
  hash: string;
  /** 序号 */
  sequence: number;
  /** 是否被篡改 */
  tampered?: boolean;
}

/** 链验证结果 */
export interface ChainVerificationResult {
  /** 链是否完整 */
  valid: boolean;
  /** 验证事件总数 */
  totalEvents: number;
  /** 有效事件数 */
  validEvents: number;
  /** 第一个异常事件的序号（若有） */
  firstInvalidIndex: number | null;
  /** 异常详情 */
  issues: ChainIssue[];
}

/** 链异常 */
export interface ChainIssue {
  /** 事件序号 */
  sequence: number;
  /** 事件 ID */
  eventId: string;
  /** 异常类型 */
  type: 'hash_mismatch' | 'chain_break' | 'missing_prev' | 'missing_event';
  /** 描述 */
  message: string;
  /** 期望哈希 */
  expectedHash?: string;
  /** 实际哈希 */
  actualHash?: string;
}

/** Merkle 链配置 */
export interface MerkleChainConfig {
  /** 初始哈希种子（可选） */
  seed?: string;
  /** 哈希算法（默认 sha256） */
  algorithm?: 'sha256' | 'sha512';
}

// ─────────────────────────────────────────────
// Merkle 哈希链实现
// ─────────────────────────────────────────────

/**
 * Merkle 哈希链
 * 
 * 为事件序列构建不可篡改的哈希链，类似区块链的轻量实现。
 * 每个事件的哈希依赖前一事件，形成单向因果链。
 * 
 * @example
 * ```typescript
 * const chain = new MerkleChain();
 * const event1 = chain.append({ action: 'login', user: 'admin' });
 * const event2 = chain.append({ action: 'query', table: 'users' });
 * 
 * // 验证链完整性
 * const result = chain.verify();
 * console.log(result.valid); // true
 * 
 * // 篡改检测
 * event2.data.action = 'delete'; // 篡改
 * const tampered = chain.verify();
 * console.log(tampered.valid); // false
 * ```
 */
export class MerkleChain {
  private events: ChainedEvent[] = [];
  private lastHash: string | null = null;
  private sequence = 0;
  private algorithm: string;

  constructor(config?: MerkleChainConfig) {
    this.algorithm = config?.algorithm ?? 'sha256';
    if (config?.seed) {
      this.lastHash = this._computeHash(config.seed);
    }
  }

  /**
   * 追加事件到链尾
   * @param data 事件数据
   * @param id 可选事件 ID（默认自动生成）
   * @returns 链式事件对象
   */
  append<T = Record<string, unknown>>(data: T, id?: string): ChainedEvent<T> {
    const eventId = id ?? this._generateId();
    const timestamp = new Date().toISOString();
    const sequence = this.sequence++;

    // 计算哈希：SHA256(data_json + prev_hash)
    const dataStr = this._serialize(data);
    const hashInput = this.lastHash ? `${dataStr}|${this.lastHash}` : dataStr;
    const hash = this._computeHash(hashInput);

    const event: ChainedEvent<T> = {
      id: eventId,
      data,
      timestamp,
      prevHash: this.lastHash,
      hash,
      sequence,
      tampered: false,
    };

    this.events.push(event as ChainedEvent);
    this.lastHash = hash;

    return event;
  }

  /**
   * 批量追加事件
   * @param dataArray 事件数据数组
   * @returns 链式事件数组
   */
  appendBatch<T = Record<string, unknown>>(dataArray: T[]): ChainedEvent<T>[] {
    return dataArray.map(data => this.append(data));
  }

  /**
   * 验证链完整性（纯验证，无副作用）
   *
   * 不修改事件对象的 tampered 标记，只返回验证结果。
   * 如需标记篡改事件，请调用 verifyAndMark()。
   *
   * @returns 验证结果
   */
  verify(): ChainVerificationResult {
    return this._doVerify();
  }

  /**
   * 验证链完整性并标记篡改事件
   *
   * 与 verify() 的区别：此方法会将异常事件的 tampered 标记设为 true。
   * 建议在需要审计时使用此方法，在纯验证场景使用 verify()。
   *
   * @returns 验证结果
   */
  verifyAndMark(): ChainVerificationResult {
    const result = this._doVerify();

    // 标记篡改事件
    if (result.firstInvalidIndex !== null) {
      for (let i = result.firstInvalidIndex; i < this.events.length; i++) {
        this.events[i].tampered = true;
      }
    }

    return result;
  }

  /**
   * 内部验证逻辑（不含副作用）
   * @private
   */
  private _doVerify(): ChainVerificationResult {
    const issues: ChainIssue[] = [];
    let validCount = 0;
    let firstInvalidIndex: number | null = null;
    let prevHash: string | null = null;

    for (let i = 0; i < this.events.length; i++) {
      const event = this.events[i];

      // 检查 prev_hash 连接
      if (event.prevHash !== prevHash) {
        issues.push({
          sequence: event.sequence,
          eventId: event.id,
          type: 'chain_break',
          message: `事件 #${event.sequence} 的 prevHash 不匹配。期望: ${prevHash}, 实际: ${event.prevHash}`,
          expectedHash: prevHash ?? undefined,
          actualHash: event.prevHash ?? undefined,
        });
        if (firstInvalidIndex === null) firstInvalidIndex = i;
        continue;
      }

      // 重新计算哈希
      const dataStr = this._serialize(event.data);
      const hashInput = prevHash ? `${dataStr}|${prevHash}` : dataStr;
      const expectedHash = this._computeHash(hashInput);

      if (event.hash !== expectedHash) {
        issues.push({
          sequence: event.sequence,
          eventId: event.id,
          type: 'hash_mismatch',
          message: `事件 #${event.sequence} 的哈希不匹配。数据可能已被篡改。`,
          expectedHash,
          actualHash: event.hash,
        });
        if (firstInvalidIndex === null) firstInvalidIndex = i;
      } else {
        validCount++;
      }

      prevHash = event.hash;
    }

    return {
      valid: issues.length === 0,
      totalEvents: this.events.length,
      validEvents: validCount,
      firstInvalidIndex,
      issues,
    };
  }

  /**
   * 验证单个事件的哈希
   * @param event 链式事件
   * @param prevHash 前一事件哈希（链头传 null）
   * @returns 哈希是否有效
   */
  verifyEvent(event: ChainedEvent, prevHash: string | null): boolean {
    const dataStr = this._serialize(event.data);
    const hashInput = prevHash ? `${dataStr}|${prevHash}` : dataStr;
    const expectedHash = this._computeHash(hashInput);
    return event.hash === expectedHash;
  }

  /**
   * 获取链中所有事件
   */
  getEvents(): ChainedEvent[] {
    return [...this.events];
  }

  /**
   * 获取事件数量
   */
  get length(): number {
    return this.events.length;
  }

  /**
   * 获取最新事件的哈希
   */
  get latestHash(): string | null {
    return this.lastHash;
  }

  /**
   * 获取链的 Merkle Root（所有事件哈希的哈希）
   * @returns Merkle Root 哈希
   */
  getMerkleRoot(): string {
    if (this.events.length === 0) return this._computeHash('');
    if (this.events.length === 1) return this.events[0].hash;

    // 构建 Merkle 树
    let hashes = this.events.map(e => e.hash);
    while (hashes.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < hashes.length; i += 2) {
        if (i + 1 < hashes.length) {
          next.push(this._computeHash(`${hashes[i]}|${hashes[i + 1]}`));
        } else {
          next.push(hashes[i]); // 奇数个，最后一个直接上升
        }
      }
      hashes = next;
    }
    return hashes[0];
  }

  /**
   * 导出链数据（用于持久化）
   */
  export(): Array<{ id: string; data: unknown; timestamp: string; prevHash: string | null; hash: string; sequence: number }> {
    return this.events.map(e => ({
      id: e.id,
      data: e.data,
      timestamp: e.timestamp,
      prevHash: e.prevHash,
      hash: e.hash,
      sequence: e.sequence,
    }));
  }

  /**
   * 从导出数据恢复链
   * @param exported 导出的链数据
   * @param config 可选配置
   * @returns MerkleChain 实例
   */
  static import(
    exported: Array<{ id: string; data: unknown; timestamp: string; prevHash: string | null; hash: string; sequence: number }>,
    config?: MerkleChainConfig,
  ): MerkleChain {
    const chain = new MerkleChain(config);
    for (const item of exported) {
      const event: ChainedEvent = {
        id: item.id,
        data: item.data as Record<string, unknown>,
        timestamp: item.timestamp,
        prevHash: item.prevHash,
        hash: item.hash,
        sequence: item.sequence,
      };
      chain.events.push(event);
      chain.lastHash = event.hash;
      chain.sequence = Math.max(chain.sequence, item.sequence + 1);
    }
    return chain;
  }

  /**
   * 清空链
   */
  clear(): void {
    this.events = [];
    this.lastHash = null;
    this.sequence = 0;
  }

  // ─── 私有方法 ───

  private _computeHash(data: string): string {
    return createHash(this.algorithm as 'sha256').update(data, 'utf-8').digest('hex');
  }

  private _serialize(data: unknown): string {
    // 处理 null prototype 对象（Object.create(null) 无 toString 等方法）
    // 和基本类型（number/string/boolean/undefined）
    if (data === null || data === undefined) {
      return JSON.stringify(data);
    }
    if (typeof data !== 'object') {
      return JSON.stringify(data);
    }
    // 安全获取键：处理 null prototype 对象
    const keys = Object.keys(data as Record<string, unknown>);
    return JSON.stringify(data, keys.sort());
  }

  private _generateId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

// ─────────────────────────────────────────────
// 便利函数
// ─────────────────────────────────────────────

/**
 * 快速计算数据的哈希
 * @param data 数据
 * @param algorithm 哈希算法
 * @returns 哈希字符串
 */
export function computeEventHash(data: unknown, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
  if (data === null || data === undefined) {
    return createHash(algorithm).update(JSON.stringify(data), 'utf-8').digest('hex');
  }
  if (typeof data !== 'object') {
    return createHash(algorithm).update(JSON.stringify(data), 'utf-8').digest('hex');
  }
  const keys = Object.keys(data as Record<string, unknown>);
  const dataStr = JSON.stringify(data, keys.sort());
  return createHash(algorithm).update(dataStr, 'utf-8').digest('hex');
}
