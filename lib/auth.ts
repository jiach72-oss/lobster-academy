import crypto from 'crypto';

// C4: 密码哈希
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:100000:${hash}`;
}

// C4: 时序安全密码验证 — 无论格式是否正确都执行哈希计算，防止计时攻击
export function verifyPassword(password: string, storedHash: string): boolean {
  // 格式错误时使用假盐假哈希，保证恒定时间
  if (!storedHash || !storedHash.includes(':')) {
    crypto.pbkdf2Sync(password || '', 'fake-salt-padding-16', 100000, 64, 'sha512');
    return false;
  }

  const parts = storedHash.split(':');
  if (parts.length < 3) {
    crypto.pbkdf2Sync(password || '', 'fake-salt-padding-16', 100000, 64, 'sha512');
    return false;
  }

  const [salt, iterations, hash] = parts;
  try {
    const iterNum = parseInt(iterations);
    if (!Number.isFinite(iterNum) || iterNum <= 0) {
      crypto.pbkdf2Sync(password || '', 'fake-salt-padding-16', 100000, 64, 'sha512');
      return false;
    }

    const computed = crypto.pbkdf2Sync(password, salt, iterNum, 64, 'sha512').toString('hex');

    // 确保两个 buffer 长度一致再用 timingSafeEqual
    const hashBuf = Buffer.from(hash, 'hex');
    const computedBuf = Buffer.from(computed, 'hex');

    if (hashBuf.length !== computedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuf, computedBuf);
  } catch {
    return false;
  }
}
