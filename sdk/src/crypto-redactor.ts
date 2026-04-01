/**
 * MirrorAI CryptoRedactor — 可逆脱敏
 * 使用 AES-256-GCM 加密替代替换，支持事后还原
 */

import * as crypto from 'crypto';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

export interface EncryptedToken {
  __mirrorai_encrypted__: true;
  salt: string;
  iv: string;
  data: string;
  tag: string;
  pattern: string; // 原始匹配的模式名
}

export class CryptoRedactor {
  private key: Buffer;
  private secret: string;
  private salt: string;

  constructor(secret: string, salt?: string) {
    if (!secret || typeof secret !== 'string' || secret.length < 8) {
      throw new Error('CryptoRedactor requires a non-empty secret of at least 8 characters');
    }
    this.secret = secret;
    this.salt = salt || crypto.randomBytes(16).toString('hex');
    this.key = scryptSync(secret, this.salt, 32);
  }

  /**
   * 加密脱敏（可逆）
   */
  redact(text: string, patternName: string, match: string): string {
    if (typeof text !== 'string' || typeof match !== 'string' || typeof patternName !== 'string') {
      return text ?? '';
    }
    if (!match) {
      return text;
    }
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    let encrypted = cipher.update(match, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    const token: EncryptedToken = {
      __mirrorai_encrypted__: true,
      salt: this.salt,
      iv: iv.toString('hex'),
      data: encrypted,
      tag: tag.toString('hex'),
      pattern: patternName,
    };

    return JSON.stringify(token);
  }

  /**
   * 还原脱敏内容
   */
  restore(encryptedJson: string): string {
    let token: EncryptedToken;
    try {
      token = JSON.parse(encryptedJson);
    } catch (parseError) {
      console.warn('[MirrorAI][CryptoRedactor] JSON parse failed during restore, returning original data:', (parseError as Error).message);
      return encryptedJson;
    }

    if (!token.__mirrorai_encrypted__) {
      console.warn('[MirrorAI][CryptoRedactor] Missing __mirrorai_encrypted__ marker, returning original data');
      return encryptedJson;
    }

    try {
      const key = scryptSync(this.secret, token.salt, 32);
      const iv = Buffer.from(token.iv, 'hex');
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(Buffer.from(token.tag, 'hex'));

      let decrypted = decipher.update(token.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (decryptError) {
      console.warn('[MirrorAI][CryptoRedactor] Decryption failed (wrong key or corrupted data):', (decryptError as Error).message);
      return encryptedJson;
    }
  }

  /**
   * 批量还原
   */
  restoreAll(text: string): string {
    return text.replace(/\{"__mirrorai_encrypted__":true[^}]+\}/g, (match) => {
      return this.restore(match);
    });
  }
}
