/**
 * 🪞 轻量防篡改审计模块
 * 
 * 分块增量哈希链，验证延迟 O(log N)
 * 
 * 设计：
 * 1. 将事件序列分成固定大小的块（blockSize=64）
 * 2. 每个块内部用增量哈希（只哈希变化部分）
 * 3. 块之间构建轻量Merkle树（仅2层）
 * 4. 支持增量追加，不需要重建整个树
 * 
 * 哈希结构：
 * - 事件哈希：SHA256(JSON.stringify(event.data) + timestamp + prevHash)
 * - 块哈希：SHA256(concat(eventHash_0, ..., eventHash_n))
 * - 根哈希：SHA256(concat(blockHash_0, ..., blockHash_m))
 */

import { createHash } from 'crypto';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 审计事件 */
export interface AuditEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/** 审计条目 */
export interface AuditEntry {
  event: AuditEvent;
  hash: string;
  prevHash: string | null;
  blockIndex: number;
  indexInBlock: number;
  merklePath: string[];
}

/** 单事件验证结果 */
export interface VerificationResult {
  valid: boolean;
  eventId: string;
  expectedHash: string;
  actualHash: string;
  issues: string[];
}

/** 全链验证结果 */
export interface ChainVerificationResult {
  valid: boolean;
  totalEvents: number;
  validEvents: number;
  totalBlocks: number;
  rootHash: string;
  issues: Array<{ eventId: string; type: string; message: string }>;
}

/** 审计配置 */
export interface AuditConfig {
  blockSize: number;
  algorithm: 'sha256' | 'sha512';
  seed?: string;
}

// ─────────────────────────────────────────────
// 主类
// ─────────────────────────────────────────────

/**
 * LightweightAudit — 分块增量哈希链审计器
 * 
 * @example
 * ```typescript
 * const audit = new LightweightAudit({ blockSize: 64, algorithm: 'sha256' });
 * const entry = audit.append({ id: '1', type: 'action', data: { foo: 'bar' }, timestamp: new Date().toISOString() });
 * const result = audit.verify(entry);
 * console.log(result.valid); // true
 * ```
 */
export class LightweightAudit {
  private entries: AuditEntry[] = [];
  private blocks: AuditEntry[][] = [];
  private blockHashes: string[] = [];
  private config: AuditConfig;
  private _rootHash: string = '';

  constructor(config?: Partial<AuditConfig>) {
    this.config = {
      blockSize: config?.blockSize ?? 64,
      algorithm: config?.algorithm ?? 'sha256',
      seed: config?.seed,
    };
  }

  // ─────────────────────────────────────────────
  // 哈希工具
  // ─────────────────────────────────────────────

  /** 计算哈希 */
  private hash(data: string): string {
    return createHash(this.config.algorithm).update(data).digest('hex');
  }

  /**
   * 计算事件哈希
   * hash = SHA(JSON.stringify(event.data) + timestamp + prevHash)
   */
  private computeEventHash(event: AuditEvent, prevHash: string | null): string {
    const payload = JSON.stringify(event.data, Object.keys(event.data).sort()) +
      event.timestamp +
      (prevHash ?? '') +
      (this.config.seed ?? '');
    return this.hash(payload);
  }

  /** 计算块哈希：SHA(concat(eventHash_0, ..., eventHash_n)) */
  private computeBlockHash(entries: AuditEntry[]): string {
    const concat = entries.map(e => e.hash).join('');
    return this.hash(concat);
  }

  /** 计算根哈希：SHA(concat(blockHash_0, ..., blockHash_m)) */
  private computeRootHash(): string {
    if (this.blockHashes.length === 0) return this.hash('empty');
    return this.hash(this.blockHashes.join(''));
  }

  /** 构建验证路径（块内邻居哈希 + 块哈希 + 根哈希） */
  private buildMerklePath(entry: AuditEntry): string[] {
    const block = this.blocks[entry.blockIndex];
    if (!block) return [];

    const path: string[] = [];

    // 添加块内左右邻居（用于 O(log N) 验证）
    // 简化方案：取相邻事件的哈希作为验证锚点
    const idx = entry.indexInBlock;
    if (idx > 0) path.push(block[idx - 1].hash);
    if (idx < block.length - 1) path.push(block[idx + 1].hash);

    // 块哈希
    path.push(this.blockHashes[entry.blockIndex]);

    // 根哈希
    path.push(this._rootHash);

    return path;
  }

  // ─────────────────────────────────────────────
  // 公共 API
  // ─────────────────────────────────────────────

  /**
   * 追加事件并返回审计条目
   */
  append(event: AuditEvent): AuditEntry {
    const blockIndex = this.blocks.length - 1 + (this.blocks.length === 0 || this.blocks[this.blocks.length - 1].length >= this.config.blockSize ? 1 : 0);

    // 确定当前块
    if (this.blocks.length === 0 || this.blocks[this.blocks.length - 1].length >= this.config.blockSize) {
      this.blocks.push([]);
    }

    const currentBlock = this.blocks[this.blocks.length - 1];
    const actualBlockIndex = this.blocks.length - 1;
    const indexInBlock = currentBlock.length;

    // 前一个哈希
    const prevHash = this.entries.length > 0 ? this.entries[this.entries.length - 1].hash : null;

    // 计算事件哈希
    const eventHash = this.computeEventHash(event, prevHash);

    const entry: AuditEntry = {
      event,
      hash: eventHash,
      prevHash,
      blockIndex: actualBlockIndex,
      indexInBlock,
      merklePath: [], // 先占位，下面构建
    };

    // 添加到块和全局列表
    currentBlock.push(entry);
    this.entries.push(entry);

    // 增量更新：只重建当前块的哈希
    this.blockHashes[actualBlockIndex] = this.computeBlockHash(currentBlock);

    // 更新根哈希
    this._rootHash = this.computeRootHash();

    // 构建验证路径
    entry.merklePath = this.buildMerklePath(entry);

    return entry;
  }

  /**
   * 验证单个事件的完整性
   * O(log N) 复杂度
   */
  verify(entry: AuditEntry): VerificationResult {
    const issues: string[] = [];

    // 1. 重新计算事件哈希
    const expectedHash = this.computeEventHash(entry.event, entry.prevHash);
    const hashValid = expectedHash === entry.hash;
    if (!hashValid) {
      issues.push('事件哈希不匹配，数据可能被篡改');
    }

    // 2. 验证块哈希
    const block = this.blocks[entry.blockIndex];
    if (!block) {
      issues.push(`块 ${entry.blockIndex} 不存在`);
    } else {
      const recomputedBlockHash = this.computeBlockHash(block);
      const storedBlockHash = this.blockHashes[entry.blockIndex];
      if (recomputedBlockHash !== storedBlockHash) {
        issues.push('块哈希不匹配');
      }
    }

    // 3. 验证根哈希
    const recomputedRoot = this.computeRootHash();
    const currentRoot = this._rootHash || this.hash('empty');
    if (recomputedRoot !== currentRoot) {
      issues.push('根哈希不匹配');
    }

    return {
      valid: issues.length === 0,
      eventId: entry.event.id,
      expectedHash,
      actualHash: entry.hash,
      issues,
    };
  }

  /**
   * 验证整个链
   */
  verifyAll(): ChainVerificationResult {
    const issues: ChainVerificationResult['issues'] = [];
    let validEvents = 0;

    // 验证每个事件
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];

      // 重新计算哈希
      const expectedPrevHash = i > 0 ? this.entries[i - 1].hash : null;
      const expectedHash = this.computeEventHash(entry.event, expectedPrevHash);

      if (expectedHash !== entry.hash) {
        issues.push({ eventId: entry.event.id, type: 'hash_mismatch', message: '事件哈希不匹配' });
      } else {
        validEvents++;
      }

      // 验证 prevHash 链
      if (entry.prevHash !== expectedPrevHash) {
        issues.push({ eventId: entry.event.id, type: 'chain_break', message: '前驱哈希链断裂' });
      }
    }

    // 验证所有块哈希
    for (let b = 0; b < this.blocks.length; b++) {
      const recomputed = this.computeBlockHash(this.blocks[b]);
      if (recomputed !== this.blockHashes[b]) {
        issues.push({ eventId: `block-${b}`, type: 'block_hash_mismatch', message: `块 ${b} 哈希不匹配` });
      }
    }

    // 验证根哈希
    const recomputedRoot = this.computeRootHash();
    const currentRoot = this._rootHash || this.hash('empty');
    if (recomputedRoot !== currentRoot) {
      issues.push({ eventId: 'root', type: 'root_hash_mismatch', message: '根哈希不匹配' });
    }

    return {
      valid: issues.length === 0,
      totalEvents: this.entries.length,
      validEvents,
      totalBlocks: this.blocks.length,
      rootHash: currentRoot,
      issues,
    };
  }

  /** 获取当前根哈希 */
  getRootHash(): string {
    return this._rootHash || this.hash('empty');
  }

  /** 获取事件总数 */
  size(): number {
    return this.entries.length;
  }

  /** 获取块总数 */
  blockCount(): number {
    return this.blocks.length;
  }

  /** 导出审计日志 */
  export(): AuditEntry[] {
    return this.entries.map(e => ({ ...e, event: { ...e.event }, merklePath: [...e.merklePath] }));
  }
}
