/**
 * 龙虾学院 Blackbox SDK — 密钥管理器
 * 
 * HKDF-SHA256 密钥派生 + 按时间段自动轮换 + 公钥链管理
 * 
 * 密钥派生路径：
 *   Master Key (32 bytes)
 *     ↓ HKDF-SHA256
 *   ├── Signing Key v1 (period=2026-Q1)
 *   ├── Signing Key v2 (period=2026-Q2)
 *   ├── ...
 *   └── Verification Key Chain
 */

import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto';
import nacl from 'tweetnacl';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 密钥对 */
export interface KeyPair {
  /** Ed25519 公钥 (base64) */
  publicKey: string;
  /** Ed25519 私钥 (base64) */
  secretKey: string;
}

/** 轮换后的密钥信息 */
export interface RotatedKey {
  /** 密钥版本/期间标识 */
  period: string;
  /** 公钥 (base64) */
  publicKey: string;
  /** 派生时的种子哈希（用于审计，不暴露主密钥） */
  seedHash: string;
  /** 创建时间 */
  createdAt: string;
  /** 是否激活 */
  active: boolean;
  /** 过期时间 */
  expiresAt?: string;
}

/** 公钥链条目 */
export interface PublicKeyChainEntry {
  /** 版本标识 */
  version: string;
  /** 公钥 (base64) */
  publicKey: string;
  /** 生效时间 */
  validFrom: string;
  /** 失效时间（可选） */
  validUntil?: string;
  /** 是否已撤销 */
  revoked: boolean;
}

/** 密钥管理器配置 */
export interface KeyManagerConfig {
  /** 主密钥 (base64 编码，32 字节) */
  masterKey: string;
  /** 轮换间隔（ISO 8601 duration 格式，默认 'P3M' 即季度轮换） */
  rotationInterval?: string;
  /** 密钥有效期（ISO 8601 duration 格式，默认 'P1Y' 即1年） */
  keyValidity?: string;
  /** 域分隔符（用于 HKDF 扩展不同用途的密钥） */
  domainSeparator?: string;
}

/** HKDF 配置 */
export interface HKDFConfig {
  /** 输入密钥材料 (IKM) */
  ikm: Buffer;
  /** 盐（可选，默认全零） */
  salt?: Buffer;
  /** 上下文信息 (info) */
  info: string;
  /** 输出长度（字节，默认 32） */
  length?: number;
}

// [P1 IMPLEMENTATION] Merkle 批量签名 + 可信时间戳 类型

/** Merkle 批量签名结果 */
export interface MerkleBatchSignature {
  /** Merkle Root（hex） */
  root: string;
  /** Root 的 Ed25519 签名（base64） */
  rootSignature: string;
  /** 密钥期间 */
  period: string;
  /** 叶子节点数 */
  leafCount: number;
  /** 时间戳 */
  timestamp: string;
  /** 树深度 */
  treeDepth: number;
}

/** 可信时间戳签名 */
export interface TimestampedSignature {
  /** Ed25519 签名（base64） */
  signature: string;
  /** 签名数据的 SHA256（hex） */
  hash: string;
  /** 时间戳 */
  timestamp: string;
  /** 前一事件哈希 */
  prevHash: string;
  /** 密钥期间 */
  period: string;
  /** 原始签名数据 */
  signData: string;
}

/** Merkle 路径节点 */
export interface MerklePathNode {
  /** 哈希（hex） */
  hash: string;
  /** 是否为右节点 */
  isRight: boolean;
}

// ─────────────────────────────────────────────
// [P2 IMPLEMENTATION] 密钥撤销机制
// ─────────────────────────────────────────────

/** 密钥撤销条目 */
export interface RevocationEntry {
  /** 被撤销的密钥版本/期间标识 */
  period: string;
  /** 撤销时间 */
  revokedAt: string;
  /** 撤销原因 */
  reason: string;
  /** 撤销者标识 */
  revokedBy?: string;
}

/** 撤销事件审计日志条目 */
export interface RevocationAuditLog {
  /** 事件 ID */
  eventId: string;
  /** 事件类型 */
  eventType: 'revoke' | 'check' | 'restore';
  /** 密钥期间 */
  period: string;
  /** 时间戳 */
  timestamp: string;
  /** 详情 */
  details: string;
  /** 触发来源 */
  source?: string;
}

// ─────────────────────────────────────────────
// [P1 IMPLEMENTATION] Merkle 树实现
// ─────────────────────────────────────────────

/** Merkle 树 */
interface MerkleTreeResult {
  /** 根哈希 */
  root: Buffer;
  /** 树深度 */
  depth: number;
  /** 所有层级的哈希（用于生成路径） */
  layers: Buffer[][];
}

/**
 * Merkle 树构建器
 * 用于批量签名：构建叶子哈希的 Merkle 树，对 Root 签名
 */
class MerkleTree {
  /**
   * 从叶子节点构建 Merkle 树
   * @param leaves 叶子哈希数组
   * @returns Merkle 树结果
   */
  static build(leaves: Buffer[]): MerkleTreeResult {
    if (leaves.length === 0) {
      throw new Error('Cannot build Merkle tree from empty leaves');
    }

    const layers: Buffer[][] = [leaves];
    let currentLayer = leaves;

    while (currentLayer.length > 1) {
      const nextLayer: Buffer[] = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : currentLayer[i]; // 奇数时复制最后一个
        const parent = createHash('sha256').update(Buffer.concat([left, right])).digest();
        nextLayer.push(parent);
      }
      layers.push(nextLayer);
      currentLayer = nextLayer;
    }

    return {
      root: currentLayer[0],
      depth: layers.length - 1,
      layers,
    };
  }

  /**
   * 获取指定叶子节点的 Merkle Path
   * @param layers Merkle 树层级
   * @param index 叶子索引
   * @returns Merkle Path（兄弟哈希数组）
   */
  static getPath(layers: Buffer[][], index: number): Buffer[] {
    const path: Buffer[] = [];

    for (let level = 0; level < layers.length - 1; level++) {
      const layer = layers[level];
      const siblingIdx = index % 2 === 0 ? index + 1 : index - 1;
      const sibling = siblingIdx < layer.length ? layer[siblingIdx] : layer[index];
      path.push(sibling);
      index = Math.floor(index / 2);
    }

    return path;
  }

  /**
   * 获取 Merkle Path 节点详情（含方向信息）
   */
  static getPathNodes(layers: Buffer[][], index: number): MerklePathNode[] {
    const path: MerklePathNode[] = [];

    for (let level = 0; level < layers.length - 1; level++) {
      const layer = layers[level];
      const isRight = index % 2 === 0; // 当前节点在左，兄弟在右
      const siblingIdx = isRight ? index + 1 : index - 1;
      const sibling = siblingIdx < layer.length ? layer[siblingIdx] : layer[index];
      path.push({
        hash: sibling.toString('hex'),
        isRight,
      });
      index = Math.floor(index / 2);
    }

    return path;
  }
}

// ─────────────────────────────────────────────
// HKDF-SHA256 实现
// ─────────────────────────────────────────────

/**
 * HKDF-SHA256 密钥派生函数
 * 
 * 基于 RFC 5869，使用 HMAC-SHA256 实现。
 * 
 * @param config HKDF 配置
 * @returns 派生密钥 Buffer
 */
export function hkdf(config: HKDFConfig): Buffer {
  const { ikm, info, length = 32 } = config;
  const salt = config.salt ?? Buffer.alloc(32, 0);

  // Step 1: Extract — PRK = HMAC-SHA256(salt, IKM)
  const prk = createHmac('sha256', salt).update(ikm).digest();

  // Step 2: Expand — OKM = HMAC-SHA256(PRK, info || counter)
  const infoBuf = Buffer.from(info, 'utf-8');
  const hashLen = 32; // SHA-256 输出长度
  const iterations = Math.ceil(length / hashLen);

  const okmParts: Buffer[] = [];
  let prev = Buffer.alloc(0);

  for (let i = 1; i <= iterations; i++) {
    const hmac = createHmac('sha256', prk);
    hmac.update(prev);
    hmac.update(infoBuf);
    hmac.update(Buffer.from([i]));
    prev = hmac.digest();
    okmParts.push(prev);
  }

  return Buffer.concat(okmParts).slice(0, length);
}

// ─────────────────────────────────────────────
// 密钥管理器
// ─────────────────────────────────────────────

/**
 * 密钥管理器
 * 
 * 管理 Ed25519 签名密钥的完整生命周期：
 * - HKDF-SHA256 从主密钥派生签名密钥
 * - 按时间段自动轮换
 * - 公钥链管理（验证时根据时间选择对应公钥）
 * 
 * @example
 * ```typescript
 * const km = new KeyManager({ masterKey: 'base64-encoded-32-bytes' });
 * 
 * // 获取当前期间的签名密钥
 * const key = km.getCurrentKey();
 * 
 * // 签名
 * const sig = km.sign('data to sign');
 * 
 * // 验证（自动选择对应期间的公钥）
 * const valid = km.verify('data', sig, '2026-Q1');
 * ```
 */
export class KeyManager {
  private masterKey: Buffer;
  private rotationInterval: string;
  private keyValidity: string;
  private domainSeparator: string;
  private rotatedKeys: Map<string, RotatedKey> = new Map();
  private publicKeyChain: PublicKeyChainEntry[] = [];
  // [P2 IMPLEMENTATION] 密钥撤销列表 (CRL)
  private certificateRevocationList: Map<string, RevocationEntry> = new Map();
  private revocationAuditLog: RevocationAuditLog[] = [];

  constructor(config: KeyManagerConfig) {
    // 解析主密钥
    const keyBuf = Buffer.from(config.masterKey, 'base64');
    if (keyBuf.length !== 32) {
      throw new Error(`Master key must be 32 bytes, got ${keyBuf.length}`);
    }
    this.masterKey = keyBuf;
    this.rotationInterval = config.rotationInterval ?? 'P3M';
    this.keyValidity = config.keyValidity ?? 'P1Y';
    this.domainSeparator = config.domainSeparator ?? 'lobster-academy-signing';
  }

  /**
   * 获取当前期间标识
   * @param date 可选日期（默认当前时间）
   * @returns 期间标识（如 "2026-Q1"）
   */
  getCurrentPeriod(date?: Date): string {
    const d = date ?? new Date();
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-indexed
    const quarter = Math.floor(month / 3) + 1;
    return `${year}-Q${quarter}`;
  }

  /**
   * 派生指定期间的签名密钥对
   * @param period 期间标识
   * @returns Ed25519 密钥对
   */
  deriveKeyPair(period?: string): KeyPair {
    const p = period ?? this.getCurrentPeriod();

    // HKDF 派生 32 字节种子
    const seed = hkdf({
      ikm: this.masterKey,
      info: `${this.domainSeparator}:${p}`,
      length: 32,
    });

    // 用种子生成 Ed25519 密钥对
    const kp = nacl.sign.keyPair.fromSeed(seed);

    // [P0-4 FIX] 派生完成后清零种子 Buffer，减少敏感材料在内存中的驻留时间
    seed.fill(0);

    return {
      publicKey: Buffer.from(kp.publicKey).toString('base64'),
      secretKey: Buffer.from(kp.secretKey).toString('base64'),
    };
  }

  /**
   * 获取当前期间的密钥对
   */
  getCurrentKey(): KeyPair {
    return this.deriveKeyPair();
  }

  /**
   * 轮换密钥（生成新期间的密钥并注册到公钥链）
   * @param period 新期间标识（默认自动计算下一期）
   * @returns 轮换后的密钥信息
   */
  rotate(period?: string): RotatedKey {
    const p = period ?? this._nextPeriod();
    const kp = this.deriveKeyPair(p);

    // 计算种子哈希（审计用）
    const seedHash = createHash('sha256')
      .update(Buffer.from(kp.secretKey, 'base64'))
      .digest('hex')
      .slice(0, 16);

    const rotatedKey: RotatedKey = {
      period: p,
      publicKey: kp.publicKey,
      seedHash,
      createdAt: new Date().toISOString(),
      active: true,
    };

    this.rotatedKeys.set(p, rotatedKey);

    // 添加到公钥链
    this.publicKeyChain.push({
      version: p,
      publicKey: kp.publicKey,
      validFrom: new Date().toISOString(),
      revoked: false,
    });

    // 停用旧密钥
    for (const [oldPeriod, oldKey] of this.rotatedKeys) {
      if (oldPeriod !== p && oldKey.active) {
        oldKey.active = false;
        oldKey.expiresAt = new Date().toISOString();
      }
    }

    return rotatedKey;
  }

  /**
   * 使用指定期间的密钥签名数据
   * @param data 待签名数据
   * @param period 期间标识（默认当前期间）
   * @returns base64 编码的签名
   */
  sign(data: string, period?: string): string {
    const kp = this.deriveKeyPair(period);
    const message = Buffer.from(data, 'utf-8');
    const secretKeyBuf = Buffer.from(kp.secretKey, 'base64');
    const signature = nacl.sign.detached(message, secretKeyBuf);
    // [P0-4 FIX] 签名完成后立即清零私钥 Buffer，防止明文密钥长驻内存
    secretKeyBuf.fill(0);
    return Buffer.from(signature).toString('base64');
  }

  /**
   * 验证签名
   * @param data 原始数据
   * @param signatureBase64 签名 (base64)
   * @param period 期间标识（用于选择公钥）
   * @returns 签名是否有效
   */
  verify(data: string, signatureBase64: string, period: string): boolean {
    try {
      const kp = this.deriveKeyPair(period);
      const message = Buffer.from(data, 'utf-8');
      const signature = Buffer.from(signatureBase64, 'base64');
      const publicKey = Buffer.from(kp.publicKey, 'base64');

      if (signature.length !== 64 || publicKey.length !== 32) return false;

      return nacl.sign.detached.verify(message, signature, publicKey);
    } catch {
      return false;
    }
  }

  /**
   * 获取公钥链
   */
  getPublicKeyChain(): PublicKeyChainEntry[] {
    return [...this.publicKeyChain];
  }

  /**
   * 获取指定期间的公钥
   */
  getPublicKey(period: string): string | null {
    const entry = this.publicKeyChain.find(e => e.version === period && !e.revoked);
    return entry?.publicKey ?? null;
  }

  /**
   * 撤销指定期间的密钥
   */
  revoke(period: string): void {
    const entry = this.publicKeyChain.find(e => e.version === period);
    if (entry) {
      entry.revoked = true;
      entry.validUntil = new Date().toISOString();
    }

    const rotated = this.rotatedKeys.get(period);
    if (rotated) {
      rotated.active = false;
      rotated.expiresAt = new Date().toISOString();
    }
  }

  // ─────────────────────────────────────────────
  // [P2 IMPLEMENTATION] 密钥撤销机制 (CRL)
  // ─────────────────────────────────────────────

  /**
   * 将密钥加入撤销列表（CRL）
   *
   * @param period 密钥期间标识
   * @param reason 撤销原因
   * @param revokedBy 撤销者标识（可选）
   * @returns 撤销条目
   *
   * @example
   * ```typescript
   * km.revokeKey('2026-Q1', '密钥疑似泄露', 'admin@example.com');
   * ```
   */
  revokeKey(period: string, reason: string, revokedBy?: string): RevocationEntry {
    const entry: RevocationEntry = {
      period,
      revokedAt: new Date().toISOString(),
      reason,
      revokedBy,
    };

    this.certificateRevocationList.set(period, entry);

    // 同时调用原有 revoke 逻辑
    this.revoke(period);

    // 写入审计日志
    this._addAuditLog('revoke', period, `密钥撤销: ${reason}`);

    return entry;
  }

  /**
   * 检查指定期间的密钥是否已被撤销
   *
   * @param period 密钥期间标识
   * @returns 是否已撤销
   *
   * @example
   * ```typescript
   * if (km.isKeyRevoked('2026-Q1')) {
   *   throw new Error('该密钥已撤销，无法使用');
   * }
   * ```
   */
  isKeyRevoked(period: string): boolean {
    const revoked = this.certificateRevocationList.has(period);
    // 写入审计日志（检查操作）
    this._addAuditLog('check', period, revoked ? '密钥已撤销' : '密钥有效');
    return revoked;
  }

  /**
   * 签名前检查密钥是否已撤销（带审计日志）
   *
   * @param data 待签名数据
   * @param period 期间标识
   * @returns base64 编码的签名
   * @throws 密钥已撤销时抛出错误
   */
  signWithRevocationCheck(data: string, period?: string): string {
    const p = period ?? this.getCurrentPeriod();
    if (this.isKeyRevoked(p)) {
      throw new Error(`密钥期间 ${p} 已被撤销，无法签名`);
    }
    return this.sign(data, p);
  }

  /**
   * 验证签名前检查密钥是否已撤销（带审计日志）
   *
   * @param data 原始数据
   * @param signatureBase64 签名 (base64)
   * @param period 期间标识
   * @returns 签名是否有效且密钥未撤销
   */
  verifyWithRevocationCheck(data: string, signatureBase64: string, period: string): boolean {
    if (this.isKeyRevoked(period)) {
      return false; // 密钥已撤销，签名无效
    }
    return this.verify(data, signatureBase64, period);
  }

  /**
   * 获取完整的撤销列表 (CRL)
   *
   * @returns 撤销条目数组
   */
  getCRL(): RevocationEntry[] {
    return Array.from(this.certificateRevocationList.values());
  }

  /**
   * 恢复已撤销的密钥（从 CRL 中移除）
   *
   * @param period 密钥期间标识
   * @returns 是否成功恢复
   */
  restoreKey(period: string): boolean {
    const existed = this.certificateRevocationList.has(period);
    if (existed) {
      this.certificateRevocationList.delete(period);
      this._addAuditLog('restore', period, '密钥已恢复');
    }
    return existed;
  }

  /**
   * 获取撤销审计日志
   *
   * @param period 可选，按期间过滤
   * @returns 审计日志数组
   */
  getRevocationAuditLog(period?: string): RevocationAuditLog[] {
    if (period) {
      return this.revocationAuditLog.filter(log => log.period === period);
    }
    return [...this.revocationAuditLog];
  }

  /**
   * 检查密钥并自动拒绝撤销密钥的签名/验证操作
   * @private
   */
  private _addAuditLog(
    eventType: RevocationAuditLog['eventType'],
    period: string,
    details: string,
  ): void {
    this.revocationAuditLog.push({
      eventId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventType,
      period,
      timestamp: new Date().toISOString(),
      details,
    });
  }

  /**
   * 获取所有轮换密钥信息
   */
  getRotatedKeys(): RotatedKey[] {
    return Array.from(this.rotatedKeys.values());
  }

  /**
   * 获取当前活跃密钥
   */
  getActiveKey(): RotatedKey | null {
    for (const key of this.rotatedKeys.values()) {
      if (key.active) return key;
    }
    return null;
  }

  /**
   * 导出公钥链（用于分发给验证方）
   */
  exportPublicKeyChain(): Array<{ version: string; publicKey: string; validFrom: string; validUntil?: string }> {
    return this.publicKeyChain
      .filter(e => !e.revoked)
      .map(e => ({
        version: e.version,
        publicKey: e.publicKey,
        validFrom: e.validFrom,
        ...(e.validUntil && { validUntil: e.validUntil }),
      }));
  }

  /**
   * [P0-4 FIX] 销毁密钥管理器，清零所有密钥材料
   * 调用后不应再使用此实例
   */
  destroy(): void {
    // 清零主密钥
    if (this.masterKey) {
      this.masterKey.fill(0);
    }
    // 清除轮换密钥记录
    this.rotatedKeys.clear();
    // 清除公钥链
    this.publicKeyChain.length = 0;
  }

  /**
   * 生成随机主密钥
   * @returns base64 编码的 32 字节密钥
   */
  static generateMasterKey(): string {
    return randomBytes(32).toString('base64');
  }

  // ─── 私有方法 ───

  /**
   * [P1 IMPLEMENTATION] Merkle 批量签名
   * 构建事件批次的 Merkle 树，对 Root 签名。
   * 单事件验证：Merkle Path（log N 个哈希）。
   * 
   * @param events 事件数据数组（字符串）
   * @param period 期间标识（默认当前）
   * @returns Merkle 批量签名结果
   */
  signBatch(events: string[], period?: string): MerkleBatchSignature {
    if (events.length === 0) {
      throw new Error('Cannot sign empty batch');
    }

    // 构建 Merkle 树
    const leaves = events.map(e => createHash('sha256').update(e, 'utf-8').digest());
    const tree = MerkleTree.build(leaves);

    // 对 Merkle Root 签名
    const rootHex = tree.root.toString('hex');
    const kp = this.deriveKeyPair(period);
    const message = Buffer.from(rootHex, 'hex');
    const secretKeyBuf = Buffer.from(kp.secretKey, 'base64');
    const signature = nacl.sign.detached(message, secretKeyBuf);
    secretKeyBuf.fill(0);

    return {
      root: rootHex,
      rootSignature: Buffer.from(signature).toString('base64'),
      period: period ?? this.getCurrentPeriod(),
      leafCount: events.length,
      timestamp: new Date().toISOString(),
      treeDepth: tree.depth,
    };
  }

  /**
   * [P1 IMPLEMENTATION] 验证单个事件的 Merkle Path
   * 
   * @param eventData 事件数据
   * @param index 事件在批次中的索引
   * @param merklePath Merkle 路径（log N 个哈希）
   * @param root Merkle Root
   * @returns 验证是否通过
   */
  verifyMerklePath(
    eventData: string,
    index: number,
    merklePath: Buffer[],
    root: string,
  ): boolean {
    let hash = createHash('sha256').update(eventData, 'utf-8').digest();

    for (const sibling of merklePath) {
      // 根据索引位判断左右
      if (index % 2 === 0) {
        hash = createHash('sha256').update(Buffer.concat([hash, sibling])).digest();
      } else {
        hash = createHash('sha256').update(Buffer.concat([sibling, hash])).digest();
      }
      index = Math.floor(index / 2);
    }

    return hash.toString('hex') === root;
  }

  /**
   * [P1 IMPLEMENTATION] 可信时间戳签名
   * 签名数据 = event_data + timestamp + prev_hash
   * 
   * @param eventData 事件数据
   * @param prevHash 前一事件哈希（可选）
   * @param period 期间标识
   * @returns 时间戳签名结果
   */
  signWithTimestamp(
    eventData: string,
    prevHash?: string,
    period?: string,
  ): TimestampedSignature {
    const timestamp = new Date().toISOString();
    const prev = prevHash ?? '';
    const signData = `${eventData}|${timestamp}|${prev}`;

    const kp = this.deriveKeyPair(period);
    const message = Buffer.from(signData, 'utf-8');
    const secretKeyBuf = Buffer.from(kp.secretKey, 'base64');
    const signature = nacl.sign.detached(message, secretKeyBuf);
    secretKeyBuf.fill(0);

    const hash = createHash('sha256').update(signData, 'utf-8').digest('hex');

    return {
      signature: Buffer.from(signature).toString('base64'),
      hash,
      timestamp,
      prevHash: prev,
      period: period ?? this.getCurrentPeriod(),
      signData,
    };
  }

  /**
   * [P1 IMPLEMENTATION] 验证可信时间戳签名
   */
  verifyTimestampedSignature(
    tsSig: TimestampedSignature,
    publicKeyBase64: string,
  ): boolean {
    try {
      const message = Buffer.from(tsSig.signData, 'utf-8');
      const signature = Buffer.from(tsSig.signature, 'base64');
      const publicKey = Buffer.from(publicKeyBase64, 'base64');

      if (signature.length !== 64 || publicKey.length !== 32) return false;

      // 验证签名
      const sigValid = nacl.sign.detached.verify(message, signature, publicKey);
      if (!sigValid) return false;

      // 验证哈希
      const expectedHash = createHash('sha256').update(tsSig.signData, 'utf-8').digest('hex');
      return tsSig.hash === expectedHash;
    } catch {
      return false;
    }
  }

  /** 计算下一个期间 */
  private _nextPeriod(): string {
    const current = this.getCurrentPeriod();
    const match = current.match(/^(\d{4})-Q(\d)$/);
    if (!match) return current;

    let year = parseInt(match[1], 10);
    let quarter = parseInt(match[2], 10);

    quarter++;
    if (quarter > 4) {
      quarter = 1;
      year++;
    }

    return `${year}-Q${quarter}`;
  }
}
