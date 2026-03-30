/**
 * 龙虾学院 Blackbox SDK — 存储工厂
 * 自动选择 PostgreSQL 或内存存储，支持优雅降级
 */

import { StorageAdapter } from './storage-adapter';
import { InMemoryStorage } from './in-memory-storage';
import { PgStorage, PgStorageConfig } from './pg-storage';

export interface StorageFactoryConfig {
  /** PostgreSQL 配置（不传则使用内存存储） */
  pg?: PgStorageConfig;
  /** 是否强制使用内存存储 */
  forceMemory?: boolean;
  /** 连接失败时是否静默降级到内存存储（默认 true） */
  gracefulFallback?: boolean;
}

/** 存储创建结果 */
export interface StorageResult {
  /** 存储适配器 */
  storage: StorageAdapter;
  /** 是否降级到内存存储 */
  fallback: boolean;
}

/**
 * 创建存储适配器
 *
 * 优先使用 PostgreSQL，不可用时自动降级到内存存储。
 *
 * @returns StorageResult 包含存储实例和是否降级的标记
 *
 * @example
 * ```typescript
 * // 使用环境变量 DATABASE_URL 自动连接 PG
 * const { storage, fallback } = await createStorage();
 * if (fallback) console.warn('已降级到内存存储，数据不会持久化');
 *
 * // 显式配置
 * const { storage } = await createStorage({
 *   pg: { connectionString: 'postgres://...' },
 * });
 *
 * // 强制内存存储
 * const { storage } = await createStorage({ forceMemory: true });
 * ```
 */
export async function createStorage(config?: StorageFactoryConfig): Promise<StorageResult> {
  // 强制内存模式
  if (config?.forceMemory) {
    const mem = new InMemoryStorage();
    await mem.initialize();
    return { storage: mem, fallback: false };
  }

  // 尝试 PostgreSQL
  const pgConfig = config?.pg ?? {};
  const hasPgConfig = pgConfig.connectionString || process.env.DATABASE_URL;

  if (!hasPgConfig) {
    // 无 PG 配置，使用内存存储
    console.warn('⚠️ 未检测到 PostgreSQL 配置，使用内存存储。数据将在进程重启后丢失。');
    const mem = new InMemoryStorage();
    await mem.initialize();
    return { storage: mem, fallback: true };
  }

  try {
    const pg = new PgStorage(pgConfig);
    await pg.initialize();
    console.log('✅ PostgreSQL 存储已连接');
    return { storage: pg, fallback: false };
  } catch (error) {
    const graceful = config?.gracefulFallback ?? true;

    if (graceful) {
      console.warn('⚠️ PostgreSQL 连接失败，降级到内存存储。数据将在进程重启后丢失。详情:', (error as Error).message);
      const mem = new InMemoryStorage();
      await mem.initialize();
      return { storage: mem, fallback: true };
    }

    throw error;
  }
}

export type { StorageAdapter } from './storage-adapter';
export { InMemoryStorage } from './in-memory-storage';
export { PgStorage, PgStorageConfig } from './pg-storage';
