/**
 * 速率限制模块
 * M1: 支持可选 Redis 后端（保持内存回退用于开发环境）
 */

// 速率限制存储接口
export interface RateLimitStore {
  get(key: string): { count: number; resetAt: number } | null;
  set(key: string, count: number, resetAt: number): void;
}

// 内存存储实现（开发/单机环境）
class MemoryRateLimitStore implements RateLimitStore {
  private attempts = new Map<string, { count: number; resetAt: number }>();

  get(key: string): { count: number; resetAt: number } | null {
    const record = this.attempts.get(key);
    if (!record) return null;
    // 过期清理
    if (Date.now() > record.resetAt) {
      this.attempts.delete(key);
      return null;
    }
    return record;
  }

  set(key: string, count: number, resetAt: number): void {
    this.attempts.set(key, { count, resetAt });
  }
}

// 默认内存存储实例
const defaultStore = new MemoryRateLimitStore();

// M1: 速率限制工厂函数（支持自定义存储后端）
export function createRateLimiter(store: RateLimitStore = defaultStore) {
  return function checkRateLimit(
    key: string,
    limit = 5,
    windowMs = 60000,
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const record = store.get(key);

    if (!record || now > record.resetAt) {
      const resetAt = now + windowMs;
      store.set(key, 1, resetAt);
      return { allowed: true, remaining: limit - 1, resetAt };
    }

    if (record.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: record.resetAt };
    }

    store.set(key, record.count + 1, record.resetAt);
    return { allowed: true, remaining: limit - record.count - 1, resetAt: record.resetAt };
  };
}

// 向后兼容：默认使用内存存储的 checkRateLimit
export const checkRateLimit = createRateLimiter();
