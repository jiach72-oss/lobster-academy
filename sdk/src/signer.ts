/**
 * 龙虾学院 Blackbox SDK — 签名模块
 * Ed25519 数字签名，保证记录不可篡改
 */

import { createHash } from 'crypto';
import nacl from 'tweetnacl';

export interface KeyPair {
  publicKey: string; // base64
  secretKey: string; // base64
}

export class Signer {
  private secretKey: Uint8Array | null = null;

  constructor(secretKeyBase64?: string) {
    if (secretKeyBase64) {
      const buf = Buffer.from(secretKeyBase64, 'base64');
      // Ed25519 私钥必须是 64 字节（nacl 格式）
      if (buf.length !== 64) {
        throw new Error(`Invalid signing key length: expected 64 bytes, got ${buf.length}`);
      }
      this.secretKey = buf;
    }
  }

  /** 生成新的 Ed25519 密钥对 */
  static generateKeyPair(): KeyPair {
    const kp = nacl.sign.keyPair();
    return {
      publicKey: Buffer.from(kp.publicKey).toString('base64'),
      secretKey: Buffer.from(kp.secretKey).toString('base64'),
    };
  }

  /** 计算 SHA256 哈希 */
  static hash(data: string | Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /** 签名数据 */
  sign(data: string): string {
    if (!this.secretKey) {
      throw new Error('No signing key configured. Call setKey() or pass key in constructor.');
    }
    if (typeof data !== 'string') {
      throw new TypeError('Data to sign must be a string');
    }
    const message = Buffer.from(data, 'utf-8');
    const signature = nacl.sign.detached(message, this.secretKey);
    return Buffer.from(signature).toString('base64');
  }

  /** 验证签名 */
  static verify(data: string, signatureBase64: string, publicKeyBase64: string): boolean {
    try {
      if (typeof data !== 'string' || typeof signatureBase64 !== 'string' || typeof publicKeyBase64 !== 'string') {
        return false;
      }
      if (signatureBase64.length === 0 || publicKeyBase64.length === 0) {
        return false;
      }

      // base64 完整性检查：解码后再编码必须完全匹配（防篡改追加字符）
      const signature = Buffer.from(signatureBase64, 'base64');
      const publicKey = Buffer.from(publicKeyBase64, 'base64');

      // Ed25519 签名必须是 64 字节，公钥 32 字节
      if (signature.length !== 64 || publicKey.length !== 32) return false;

      // base64 完整性检查：解码后再编码必须匹配原始输入
      // 防止追加字符攻击（Buffer.from 会忽略尾部非法字符）
      const normalize = (s: string) => s.replace(/=+$/, '');
      if (normalize(signature.toString('base64')) !== normalize(signatureBase64)) return false;
      if (normalize(publicKey.toString('base64')) !== normalize(publicKeyBase64)) return false;

      const message = Buffer.from(data, 'utf-8');
      return nacl.sign.detached.verify(message, signature, publicKey);
    } catch {
      return false;
    }
  }

  /** 设置签名密钥 */
  setKey(secretKeyBase64: string): void {
    if (typeof secretKeyBase64 !== 'string' || secretKeyBase64.length === 0) {
      throw new TypeError('Signing key must be a non-empty string');
    }
    const buf = Buffer.from(secretKeyBase64, 'base64');
    if (buf.length !== 64) {
      throw new Error(`Invalid signing key length: expected 64 bytes, got ${buf.length}`);
    }
    this.secretKey = buf;
  }

  /** 是否已配置密钥 */
  hasKey(): boolean {
    return this.secretKey !== null;
  }
}
