/** Ed25519 签名模块 */
import { createHash, createHmac, randomBytes } from 'crypto';

/** 用 HMAC-SHA256 做确定性签名（Ed25519 需要 nacl，先用 HMAC 实现，后续升级） */
export class Signer {
  private privateKey: Buffer;
  private publicKeyHex: string;

  constructor(privateKeyHex?: string) {
    if (privateKeyHex) {
      this.privateKey = Buffer.from(privateKeyHex, 'hex');
    } else {
      this.privateKey = randomBytes(32);
    }
    // 公钥 = SHA256(私钥) 前 32 字节
    this.publicKeyHex = createHash('sha256').update(this.privateKey).digest('hex').slice(0, 64);
  }

  /** 签名任意数据，返回 hex 签名 */
  sign(data: string | object): string {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    return createHmac('sha256', this.privateKey).update(payload).digest('hex');
  }

  /** 验证签名 */
  verify(data: string | object, signature: string): boolean {
    const expected = this.sign(data);
    // 常量时间比较，防时序攻击
    if (expected.length !== signature.length) return false;
    let result = 0;
    for (let i = 0; i < expected.length; i++) {
      result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return result === 0;
  }

  /** 获取公钥 (hex) */
  getPublicKey(): string {
    return this.publicKeyHex;
  }

  /** 获取私钥 (hex) */
  getPrivateKey(): string {
    return this.privateKey.toString('hex');
  }

  /** 计算内容哈希 */
  static hash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }
}
