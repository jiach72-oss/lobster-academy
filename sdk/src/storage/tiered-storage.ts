/**
 * 龙虾学院 Blackbox SDK — 分层存储引擎
 * 
 * Hot/Warm/Cold 三层存储架构：
 *   Hot Tier  → 最近数据，实时查询（如内存/Redis）
 *   Warm Tier → 近期数据，聚合分析（如 PostgreSQL/ClickHouse）
 *   Cold Tier → 历史归档，压缩存储（如 S3）
 * 
 * 存储适配器链（Chain of Responsibility）：
 *   - 写入：依次写入所有层级
 *   - 读取：按优先级查询，自动降级
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 存储层级 */
export type StorageTier = 'hot' | 'warm' | 'cold';

/** 存储条目 */
export interface StorageEntry<T = unknown> {
  /** 条目唯一 ID */
  id: string;
  /** 数据内容 */
  data: T;
  /** 时间戳 ISO8601 */
  timestamp: string;
  /** 所属层级 */
  tier?: StorageTier;
  /** 元数据 */
  metadata?: Record<string, string>;
  /** TTL（秒，Hot 层使用） */
  ttl?: number;
}

/** 存储查询条件 */
export interface StorageQuery {
  /** ID 精确匹配 */
  id?: string;
  /** 时间范围 */
  from?: string;
  to?: string;
  /** 元数据过滤 */
  metadata?: Record<string, string>;
  /** 分页 */
  limit?: number;
  offset?: number;
}

/** 存储操作结果 */
export interface StorageResult<T = unknown> {
  /** 是否成功 */
  success: boolean;
  /** 数据（查询时返回） */
  data?: T | T[];
  /** 影响的条目数 */
  count?: number;
  /** 来源层级 */
  tier?: StorageTier;
  /** 错误信息 */
  error?: string;
}

/** 存储适配器接口 */
export interface IStorageAdapter {
  /** 适配器名称 */
  readonly name: string;
  /** 适配器层级 */
  readonly tier: StorageTier;

  /** 保存条目 */
  save<T>(entry: StorageEntry<T>): Promise<StorageResult<T>>;
  /** 查询条目 */
  get<T>(id: string): Promise<StorageResult<T>>;
  /** 查询多个条目 */
  query<T>(query: StorageQuery): Promise<StorageResult<T[]>>;
  /** 删除条目 */
  delete(id: string): Promise<StorageResult<void>>;
  /** 是否可用 */
  isAvailable(): Promise<boolean>;
  /** 清空 */
  clear(): Promise<void>;
}

/** 分层存储配置 */
export interface TieredStorageConfig {
  /** 存储适配器列表（按优先级排列） */
  adapters: IStorageAdapter[];
  /** 是否启用自动降级（默认 true） */
  enableFallback?: boolean;
  /** Hot 层 TTL（秒，默认 3600） */
  hotTTL?: number;
  /** 写入失败时是否继续写入其他层（默认 true） */
  continueOnWriteFailure?: boolean;
}

/** 分层存储统计 */
export interface TieredStorageStats {
  /** 各层级写入次数 */
  writeCounts: Record<StorageTier, number>;
  /** 各层级读取次数 */
  readCounts: Record<StorageTier, number>;
  /** 降级次数 */
  fallbackCount: number;
  /** 失败次数 */
  failureCount: number;
}

// ─────────────────────────────────────────────
// 内存存储适配器（Hot Tier 默认实现）
// ─────────────────────────────────────────────

/**
 * 内存存储适配器
 * 
 * 适用于 Hot Tier，支持 TTL 过期。
 */
export class MemoryAdapter implements IStorageAdapter {
  readonly name = 'memory';
  readonly tier: StorageTier;

  private store: Map<string, { entry: StorageEntry; expiresAt: number }> = new Map();
  private defaultTTL: number;

  constructor(defaultTTL = 3600, tier: StorageTier = 'hot') {
    this.defaultTTL = defaultTTL;
    this.tier = tier;
  }

  async save<T>(entry: StorageEntry<T>): Promise<StorageResult<T>> {
    const ttl = entry.ttl ?? this.defaultTTL;
    this.store.set(entry.id, {
      entry: entry as StorageEntry,
      expiresAt: Date.now() + ttl * 1000,
    });
    return { success: true, count: 1, tier: this.tier };
  }

  async get<T>(id: string): Promise<StorageResult<T>> {
    const item = this.store.get(id);
    if (!item) return { success: false, error: 'Not found' };
    if (Date.now() > item.expiresAt) {
      this.store.delete(id);
      return { success: false, error: 'Expired' };
    }
    return { success: true, data: item.entry.data as T, tier: this.tier };
  }

  async query<T>(query: StorageQuery): Promise<StorageResult<T[]>> {
    const now = Date.now();
    // [P0-3 FIX] 先收集所有匹配条目，再统一做分页，不在收集阶段考虑 offset/limit
    // 之前在循环内提前 break 导致后续匹配条目被遗漏
    const matched: T[] = [];

    for (const [, item] of this.store) {
      if (now > item.expiresAt) {
        this.store.delete(item.entry.id);
        continue;
      }

      const entry = item.entry;

      // ID 过滤
      if (query.id && entry.id !== query.id) continue;

      // 时间范围过滤
      if (query.from && entry.timestamp < query.from) continue;
      if (query.to && entry.timestamp > query.to) continue;

      // 元数据过滤
      if (query.metadata) {
        let match = true;
        for (const [k, v] of Object.entries(query.metadata)) {
          if (entry.metadata?.[k] !== v) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      }

      matched.push(entry.data as T);
    }

    // [P0-3 FIX] 收集完所有匹配条目后，统一应用 offset 和 limit
    const offset = query.offset ?? 0;
    const sliced = query.limit !== undefined
      ? matched.slice(offset, offset + query.limit)
      : matched.slice(offset);

    return { success: true, data: sliced, count: sliced.length, tier: this.tier };
  }

  async delete(id: string): Promise<StorageResult<void>> {
    this.store.delete(id);
    return { success: true, count: 1, tier: this.tier };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  /** 获取条目数（含过期） */
  get size(): number {
    return this.store.size;
  }

  /** 清理过期条目 */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, item] of this.store) {
      if (now > item.expiresAt) {
        this.store.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}

// ─────────────────────────────────────────────
// 分层存储引擎
// ─────────────────────────────────────────────

/**
 * 分层存储引擎
 * 
 * 实现 Chain of Responsibility 模式：
 * - 写入：依次写入所有适配器
 * - 读取：按优先级查询，自动降级
 * 
 * @example
 * ```typescript
 * const storage = new TieredStorage({
 *   adapters: [
 *     new MemoryAdapter(3600),  // Hot: 1h TTL
 *     // new PgAdapter(...),    // Warm: PostgreSQL
 *     // new S3Adapter(...),    // Cold: S3
 *   ],
 * });
 * 
 * await storage.save({ id: '1', data: { ... }, timestamp: new Date().toISOString() });
 * const result = await storage.get('1');
 * ```
 */
export class TieredStorage {
  private adapters: IStorageAdapter[];
  private enableFallback: boolean;
  private continueOnWriteFailure: boolean;
  private stats: TieredStorageStats;
  private queryRouter: QueryRouter;
  private migrator: AutoMigrator | null = null;

  constructor(config: TieredStorageConfig) {
    if (!config.adapters || config.adapters.length === 0) {
      throw new Error('At least one storage adapter is required');
    }
    this.adapters = config.adapters;
    this.enableFallback = config.enableFallback ?? true;
    this.continueOnWriteFailure = config.continueOnWriteFailure ?? true;
    this.stats = {
      writeCounts: { hot: 0, warm: 0, cold: 0 },
      readCounts: { hot: 0, warm: 0, cold: 0 },
      fallbackCount: 0,
      failureCount: 0,
    };
    this.queryRouter = new QueryRouter(config.adapters);
  }

  /**
   * [P1 IMPLEMENTATION] 智能查询路由
   * 根据时间范围自动选择最优后端，跨层合并结果
   */
  async smartQuery<T>(query: StorageQuery): Promise<QueryRouteResult<T>> {
    return this.queryRouter.route<T>(query);
  }

  /**
   * [P1 IMPLEMENTATION] 启用自动迁移
   * Hot → Warm → Cold 自动迁移
   */
  enableMigration(policy?: MigrationPolicy): void {
    if (this.migrator) {
      this.migrator.stop();
    }
    this.migrator = new AutoMigrator(this.adapters, policy);
  }

  /**
   * [P1 IMPLEMENTATION] 获取迁移器
   */
  getMigrator(): AutoMigrator | null {
    return this.migrator;
  }

  /**
   * [P1 IMPLEMENTATION] 获取迁移统计
   */
  getMigrationStats(): MigrationStats | null {
    return this.migrator?.getStats() ?? null;
  }

  /**
   * 保存条目（写入所有层级）
   * @param entry 存储条目
   * @returns 操作结果
   */
  async save<T>(entry: StorageEntry<T>): Promise<StorageResult<T>> {
    let lastError: string | undefined;
    let anySuccess = false;

    for (const adapter of this.adapters) {
      try {
        if (await adapter.isAvailable()) {
          const result = await adapter.save(entry);
          if (result.success) {
            this.stats.writeCounts[adapter.tier]++;
            anySuccess = true;
          }
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        this.stats.failureCount++;
        if (!this.continueOnWriteFailure) {
          return { success: false, error: lastError };
        }
      }
    }

    if (!anySuccess) {
      return { success: false, error: lastError ?? 'All adapters failed' };
    }

    return { success: true, count: 1 };
  }

  /**
   * 查询条目（按优先级自动降级）
   * @param id 条目 ID
   * @returns 操作结果
   */
  async get<T>(id: string): Promise<StorageResult<T>> {
    for (const adapter of this.adapters) {
      try {
        if (await adapter.isAvailable()) {
          const result = await adapter.get<T>(id);
          if (result.success) {
            this.stats.readCounts[adapter.tier]++;
            return result;
          }
        }
      } catch (e) {
        this.stats.failureCount++;
        if (this.enableFallback) {
          this.stats.fallbackCount++;
          continue;
        }
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    }

    return { success: false, error: 'Not found in any tier' };
  }

  /**
   * 查询多个条目（自动路由到最优层级）
   * @param query 查询条件
   * @returns 操作结果
   */
  async query<T>(query: StorageQuery): Promise<StorageResult<T[]>> {
    // 优先尝试第一个可用适配器
    for (const adapter of this.adapters) {
      try {
        if (await adapter.isAvailable()) {
          const result = await adapter.query<T>(query);
          if (result.success && result.data && (result.data as T[]).length > 0) {
            this.stats.readCounts[adapter.tier]++;
            return result;
          }
        }
      } catch (e) {
        this.stats.failureCount++;
        if (this.enableFallback) {
          this.stats.fallbackCount++;
          continue;
        }
      }
    }

    return { success: true, data: [], count: 0 };
  }

  /**
   * 删除条目（从所有层级删除）
   * @param id 条目 ID
   */
  async delete(id: string): Promise<StorageResult<void>> {
    let anySuccess = false;

    for (const adapter of this.adapters) {
      try {
        if (await adapter.isAvailable()) {
          await adapter.delete(id);
          anySuccess = true;
        }
      } catch {
        this.stats.failureCount++;
      }
    }

    return { success: anySuccess, count: anySuccess ? 1 : 0 };
  }

  /**
   * 清空所有层级
   */
  async clear(): Promise<void> {
    for (const adapter of this.adapters) {
      try {
        await adapter.clear();
      } catch {
        // 忽略清空失败
      }
    }
  }

  /**
   * 获取存储统计
   */
  getStats(): TieredStorageStats {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      writeCounts: { hot: 0, warm: 0, cold: 0 },
      readCounts: { hot: 0, warm: 0, cold: 0 },
      fallbackCount: 0,
      failureCount: 0,
    };
  }

  /**
   * 获取所有适配器信息
   */
  getAdapters(): Array<{ name: string; tier: StorageTier }> {
    return this.adapters.map(a => ({ name: a.name, tier: a.tier }));
  }

  /**
   * 批量保存
   * @param entries 条目数组
   * @returns 操作结果
   */
  async saveBatch<T>(entries: StorageEntry<T>[]): Promise<StorageResult<T[]>> {
    const saved: T[] = [];
    for (const entry of entries) {
      const result = await this.save(entry);
      if (result.success) {
        saved.push(entry.data);
      }
    }
    return {
      success: saved.length > 0,
      data: saved,
      count: saved.length,
    };
  }

  /**
   * 检查各层级可用性
   */
  async healthCheck(): Promise<Array<{ name: string; tier: StorageTier; available: boolean }>> {
    const results = [];
    for (const adapter of this.adapters) {
      try {
        results.push({
          name: adapter.name,
          tier: adapter.tier,
          available: await adapter.isAvailable(),
        });
      } catch {
        results.push({
          name: adapter.name,
          tier: adapter.tier,
          available: false,
        });
      }
    }
    return results;
  }
}

// ─────────────────────────────────────────────
// [P1 IMPLEMENTATION] 统一查询路由 + 自动迁移
// ─────────────────────────────────────────────

/** 迁移策略 */
export interface MigrationPolicy {
  /** Hot → Warm 迁移阈值（秒），默认 3600（1小时） */
  hotToWarmSeconds?: number;
  /** Warm → Cold 迁移阈值（秒），默认 2592000（30天） */
  warmToColdSeconds?: number;
  /** 迁移检查间隔（ms），默认 60000（1分钟） */
  checkIntervalMs?: number;
  /** 是否启用自动迁移，默认 true */
  enabled?: boolean;
}

/** 查询路由结果 */
export interface QueryRouteResult<T = unknown> {
  /** 查询结果 */
  data: T[];
  /** 实际查询的后端 */
  queriedBackends: Array<{ name: string; tier: StorageTier }>;
  /** 是否跨层合并 */
  crossTier: boolean;
  /** 总耗时（ms） */
  elapsedMs: number;
}

/** 迁移统计 */
export interface MigrationStats {
  /** Hot → Warm 迁移次数 */
  hotToWarm: number;
  /** Warm → Cold 迁移次数 */
  warmToCold: number;
  /** 迁移总条目数 */
  totalMigrated: number;
  /** 最后一次迁移时间 */
  lastMigrationAt: string | null;
  /** 迁移错误次数 */
  errors: number;
}

/**
 * 查询路由器
 * 
 * 根据时间范围自动选择最优存储后端：
 * - 仅查最近 1 小时 → Hot 层
 * - 查最近 30 天 → Hot + Warm 层
 * - 查更早 → 所有层
 */
class QueryRouter {
  private adapters: IStorageAdapter[];

  constructor(adapters: IStorageAdapter[]) {
    this.adapters = adapters;
  }

  /**
   * 路由查询到最优后端
   * @param query 查询条件
   * @returns 查询路由结果
   */
  async route<T>(query: StorageQuery): Promise<QueryRouteResult<T>> {
    const startMs = performance.now();
    const queriedBackends: Array<{ name: string; tier: StorageTier }> = [];

    // 如果有时间范围，按范围选择后端
    if (query.from || query.to) {
      return this._routeByTimeRange<T>(query, startMs);
    }

    // 无时间范围，使用默认降级策略
    for (const adapter of this.adapters) {
      try {
        if (await adapter.isAvailable()) {
          const result = await adapter.query<T>(query);
          queriedBackends.push({ name: adapter.name, tier: adapter.tier });
          if (result.success && result.data && (result.data as T[]).length > 0) {
            return {
              data: result.data as T[],
              queriedBackends,
              crossTier: false,
              elapsedMs: performance.now() - startMs,
            };
          }
        }
      } catch {
        continue;
      }
    }

    return {
      data: [],
      queriedBackends,
      crossTier: false,
      elapsedMs: performance.now() - startMs,
    };
  }

  /**
   * 按时间范围路由
   *
   * [P0 FIX] 修复 Hot 层路由逻辑：
   * - 之前：仅当 query.from 在最近 1h 内才查 Hot → 查 "最近7天到现在的数据" 会跳过 Hot
   * - 现在：只要 query.to 在 Hot 覆盖范围内就查 Hot，各层按各自时间窗口查
   */
  private async _routeByTimeRange<T>(
    query: StorageQuery,
    startMs: number,
  ): Promise<QueryRouteResult<T>> {
    const now = Date.now();
    const toMs = query.to ? new Date(query.to).getTime() : now;
    const fromMs = query.from ? new Date(query.from).getTime() : 0;

    const queriedBackends: Array<{ name: string; tier: StorageTier }> = [];
    const allData: T[] = [];
    let crossTier = false;

    // Hot 层：只要查询范围与最近 1 小时有交集就查
    // Hot 数据存在于 [now - 1h, now]，与 [fromMs, toMs] 有交集 iff toMs >= now - 3600s
    const hotAdapter = this.adapters.find(a => a.tier === 'hot');
    if (hotAdapter && toMs >= now - 3600 * 1000) {
      try {
        if (await hotAdapter.isAvailable()) {
          const result = await hotAdapter.query<T>(query);
          queriedBackends.push({ name: hotAdapter.name, tier: hotAdapter.tier });
          if (result.success && result.data) {
            allData.push(...(result.data as T[]));
          }
        }
      } catch { /* continue */ }
    }

    // Warm 层：查询范围与最近 30 天有交集
    const warmAdapter = this.adapters.find(a => a.tier === 'warm');
    if (warmAdapter && toMs >= now - 2592000 * 1000) {
      try {
        if (await warmAdapter.isAvailable()) {
          const result = await warmAdapter.query<T>(query);
          queriedBackends.push({ name: warmAdapter.name, tier: warmAdapter.tier });
          if (result.success && result.data) {
            allData.push(...(result.data as T[]));
          }
        }
      } catch { /* continue */ }
    }

    // Cold 层：始终查询（覆盖所有历史数据）
    const coldAdapter = this.adapters.find(a => a.tier === 'cold');
    if (coldAdapter) {
      try {
        if (await coldAdapter.isAvailable()) {
          const result = await coldAdapter.query<T>(query);
          queriedBackends.push({ name: coldAdapter.name, tier: coldAdapter.tier });
          if (result.success && result.data) {
            allData.push(...(result.data as T[]));
          }
        }
      } catch { /* continue */ }
    }

    crossTier = queriedBackends.length > 1;

    // 去重（按 ID）
    const seen = new Set<string>();
    const unique: T[] = [];
    for (const item of allData) {
      const id = (item as Record<string, unknown>)?.id as string;
      if (id && !seen.has(id)) {
        seen.add(id);
        unique.push(item);
      } else if (!id) {
        unique.push(item);
      }
    }

    // 分页
    const offset = query.offset ?? 0;
    const paged = query.limit !== undefined
      ? unique.slice(offset, offset + query.limit)
      : unique.slice(offset);

    return {
      data: paged,
      queriedBackends,
      crossTier,
      elapsedMs: performance.now() - startMs,
    };
  }
}

/**
 * 自动迁移器
 * 
 * 后台任务定时检查，将数据在 Hot → Warm → Cold 层之间自动迁移。
 */
class AutoMigrator {
  private adapters: IStorageAdapter[];
  private policy: Required<MigrationPolicy>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stats: MigrationStats;
  private running = false;

  constructor(adapters: IStorageAdapter[], policy?: MigrationPolicy) {
    this.adapters = adapters;
    this.policy = {
      hotToWarmSeconds: policy?.hotToWarmSeconds ?? 3600,
      warmToColdSeconds: policy?.warmToColdSeconds ?? 2592000,
      checkIntervalMs: policy?.checkIntervalMs ?? 60000,
      enabled: policy?.enabled ?? true,
    };
    this.stats = {
      hotToWarm: 0,
      warmToCold: 0,
      totalMigrated: 0,
      lastMigrationAt: null,
      errors: 0,
    };

    if (this.policy.enabled) {
      this.start();
    }
  }

  /** 启动自动迁移 */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this._migrate().catch(() => {
        this.stats.errors++;
      });
    }, this.policy.checkIntervalMs);
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }
  }

  /** 停止自动迁移 */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 手动触发迁移 */
  async migrateNow(): Promise<void> {
    await this._migrate();
  }

  /** 获取统计 */
  getStats(): MigrationStats {
    return { ...this.stats };
  }

  /** 获取策略 */
  getPolicy(): MigrationPolicy {
    return { ...this.policy };
  }

  /** 更新策略 */
  updatePolicy(policy: Partial<MigrationPolicy>): void {
    Object.assign(this.policy, policy);
    if (policy.enabled !== undefined) {
      if (policy.enabled) {
        this.start();
      } else {
        this.stop();
      }
    }
  }

  /** 执行迁移 */
  private async _migrate(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const now = Date.now();
      const hotAdapter = this.adapters.find(a => a.tier === 'hot');
      const warmAdapter = this.adapters.find(a => a.tier === 'warm');
      const coldAdapter = this.adapters.find(a => a.tier === 'cold');

      // Hot → Warm
      if (hotAdapter && warmAdapter) {
        try {
          const hotItems = await hotAdapter.query({ to: new Date(now - this.policy.hotToWarmSeconds * 1000).toISOString() });
          if (hotItems.success && hotItems.data) {
            const items = hotItems.data as StorageEntry[];
            for (const item of items) {
              if (await warmAdapter.isAvailable()) {
                await warmAdapter.save(item);
                await hotAdapter.delete(item.id);
                this.stats.hotToWarm++;
                this.stats.totalMigrated++;
              }
            }
          }
        } catch { /* continue */ }
      }

      // Warm → Cold
      if (warmAdapter && coldAdapter) {
        try {
          const warmItems = await warmAdapter.query({ to: new Date(now - this.policy.warmToColdSeconds * 1000).toISOString() });
          if (warmItems.success && warmItems.data) {
            const items = warmItems.data as StorageEntry[];
            for (const item of items) {
              if (await coldAdapter.isAvailable()) {
                await coldAdapter.save(item);
                await warmAdapter.delete(item.id);
                this.stats.warmToCold++;
                this.stats.totalMigrated++;
              }
            }
          }
        } catch { /* continue */ }
      }

      this.stats.lastMigrationAt = new Date().toISOString();
    } finally {
      this.running = false;
    }
  }
}

// ─────────────────────────────────────────────
// TieredStorage 增强（追加方法）
// ─────────────────────────────────────────────

/** TieredStorage 扩展方法混入 */
export interface TieredStorageEnhanced {
  /** 智能查询路由 */
  smartQuery<T>(query: StorageQuery): Promise<QueryRouteResult<T>>;
  /** 获取迁移器 */
  getMigrator(): AutoMigrator | null;
  /** 启用自动迁移 */
  enableMigration(policy?: MigrationPolicy): void;
  /** 获取迁移统计 */
  getMigrationStats(): MigrationStats | null;
}

// ─────────────────────────────────────────────
// [P2 IMPLEMENTATION] 一致性哈希分区
// ─────────────────────────────────────────────

/** 分片信息 */
export interface ShardInfo {
  /** 分片 ID */
  shardId: string;
  /** 分片对应的存储适配器 */
  adapter: IStorageAdapter;
  /** 虚拟节点数量 */
  virtualNodeCount: number;
}

/** 分片路由结果 */
export interface ShardRouteResult {
  /** 目标分片 ID */
  shardId: string;
  /** agent_id 的哈希值（hex） */
  hashValue: string;
  /** 虚拟节点索引 */
  virtualNodeIndex: number;
}

/** 一致性哈希配置 */
export interface ConsistentHashingConfig {
  /** 分片列表 */
  shards: ShardInfo[];
  /** 每个物理节点的虚拟节点数，默认 150 */
  virtualNodesPerShard?: number;
  /** 哈希种子（用于虚拟节点哈希） */
  hashSeed?: number;
}

/**
 * 一致性哈希路由器
 *
 * 按 agent_id 将数据分配到不同分片。
 * 支持虚拟节点以实现更均匀的分布和动态扩缩容。
 *
 * @example
 * ```typescript
 * const router = new ConsistentHashingRouter({
 *   shards: [
 *     { shardId: 'shard-1', adapter: new MemoryAdapter(), virtualNodeCount: 150 },
 *     { shardId: 'shard-2', adapter: new MemoryAdapter(), virtualNodeCount: 150 },
 *   ],
 * });
 *
 * // 路由查询
 * const route = router.route('agent-001');
 * console.log(route.shardId);  // 'shard-1' 或 'shard-2'
 *
 * // 动态添加分片
 * router.addShard({ shardId: 'shard-3', adapter: new MemoryAdapter(), virtualNodeCount: 150 });
 * ```
 */
export class ConsistentHashingRouter {
  private ring: Array<{ hash: number; shardId: string }> = [];
  private shards: Map<string, ShardInfo> = new Map();
  private virtualNodesPerShard: number;
  private hashSeed: number;

  constructor(config: ConsistentHashingConfig) {
    this.virtualNodesPerShard = config.virtualNodesPerShard ?? 150;
    this.hashSeed = config.hashSeed ?? 0x9e3779b9; // 黄金比例常数

    for (const shard of config.shards) {
      this.addShard(shard);
    }
  }

  /**
   * 添加分片
   *
   * 自动分配虚拟节点并重新平衡哈希环。
   *
   * @param shard 分片信息
   */
  addShard(shard: ShardInfo): void {
    this.shards.set(shard.shardId, shard);

    // 为分片生成虚拟节点
    const vnodeCount = shard.virtualNodeCount ?? this.virtualNodesPerShard;
    for (let i = 0; i < vnodeCount; i++) {
      const hash = this._hash(`${shard.shardId}:vnode:${i}`);
      this.ring.push({ hash, shardId: shard.shardId });
    }

    // 保持环有序
    this.ring.sort((a, b) => a.hash - b.hash);
  }

  /**
   * 移除分片
   *
   * @param shardId 分片 ID
   * @returns 是否成功移除
   */
  removeShard(shardId: string): boolean {
    if (!this.shards.has(shardId)) return false;

    this.shards.delete(shardId);
    this.ring = this.ring.filter(node => node.shardId !== shardId);

    return true;
  }

  /**
   * 路由 agent_id 到目标分片
   *
   * @param agentId Agent 标识
   * @returns 路由结果
   */
  route(agentId: string): ShardRouteResult {
    if (this.ring.length === 0) {
      throw new Error('没有可用的分片');
    }

    const hashValue = this._hash(agentId);

    // 在哈希环上找到第一个 >= hashValue 的节点（二分查找）
    let lo = 0;
    let hi = this.ring.length - 1;
    let idx = 0;

    if (hashValue > this.ring[hi].hash) {
      idx = 0; // 回绕到第一个节点
    } else {
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (this.ring[mid].hash >= hashValue) {
          idx = mid;
          hi = mid - 1;
        } else {
          lo = mid + 1;
        }
      }
    }

    const node = this.ring[idx];

    return {
      shardId: node.shardId,
      hashValue: hashValue.toString(16),
      virtualNodeIndex: idx,
    };
  }

  /**
   * 获取指定 agent_id 对应的存储适配器
   *
   * @param agentId Agent 标识
   * @returns 存储适配器
   */
  getAdapter(agentId: string): IStorageAdapter {
    const routeResult = this.route(agentId);
    const shard = this.shards.get(routeResult.shardId);
    if (!shard) {
      throw new Error(`分片 ${routeResult.shardId} 不存在`);
    }
    return shard.adapter;
  }

  /**
   * 获取所有分片信息
   */
  getShards(): ShardInfo[] {
    return Array.from(this.shards.values());
  }

  /**
   * 获取哈希环统计
   */
  getRingStats(): {
    totalVirtualNodes: number;
    shardDistribution: Record<string, number>;
  } {
    const distribution: Record<string, number> = {};
    for (const node of this.ring) {
      distribution[node.shardId] = (distribution[node.shardId] ?? 0) + 1;
    }

    return {
      totalVirtualNodes: this.ring.length,
      shardDistribution: distribution,
    };
  }

  /**
   * FNV-1a 哈希函数
   * @private
   */
  private _hash(key: string): number {
    let hash = 2166136261 ^ this.hashSeed;
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return hash >>> 0;
  }
}

/**
 * 分片分层存储
 *
 * 将一致性哈希路由器与分层存储结合，
 * 实现按 agent_id 自动分片的大规模存储。
 *
 * @example
 * ```typescript
 * const sharded = new ShardedTieredStorage({
 *   shards: [
 *     { shardId: 'shard-1', adapter: new MemoryAdapter(), virtualNodeCount: 150 },
 *     { shardId: 'shard-2', adapter: new MemoryAdapter(), virtualNodeCount: 150 },
 *   ],
 * });
 *
 * // 写入（自动路由到正确的分片）
 * await sharded.saveForAgent('agent-001', {
 *   id: 'evt-1',
 *   data: { ... },
 *   timestamp: new Date().toISOString(),
 * });
 *
 * // 查询（自动路由到正确的分片）
 * const result = await sharded.queryForAgent('agent-001', { from: '2026-01-01' });
 * ```
 */
export class ShardedTieredStorage {
  private router: ConsistentHashingRouter;

  constructor(config: ConsistentHashingConfig) {
    this.router = new ConsistentHashingRouter(config);
  }

  /**
   * 为指定 Agent 保存条目（自动路由到正确分片）
   *
   * @param agentId Agent 标识
   * @param entry 存储条目
   */
  async saveForAgent<T>(agentId: string, entry: StorageEntry<T>): Promise<StorageResult<T>> {
    const adapter = this.router.getAdapter(agentId);
    try {
      return await adapter.save(entry);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * 为指定 Agent 查询条目（自动路由到正确分片）
   *
   * @param agentId Agent 标识
   * @param query 查询条件
   */
  async queryForAgent<T>(agentId: string, query: StorageQuery): Promise<StorageResult<T[]>> {
    const adapter = this.router.getAdapter(agentId);
    try {
      return await adapter.query<T>(query);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e), data: [] };
    }
  }

  /**
   * 为指定 Agent 获取单个条目
   *
   * @param agentId Agent 标识
   * @param id 条目 ID
   */
  async getForAgent<T>(agentId: string, id: string): Promise<StorageResult<T>> {
    const adapter = this.router.getAdapter(agentId);
    try {
      return await adapter.get<T>(id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * 路由查询
   *
   * @param agentId Agent 标识
   * @returns 路由结果
   */
  routeAgent(agentId: string): ShardRouteResult {
    return this.router.route(agentId);
  }

  /**
   * 动态添加分片
   *
   * @param shard 分片信息
   */
  addShard(shard: ShardInfo): void {
    this.router.addShard(shard);
  }

  /**
   * 动态移除分片
   *
   * @param shardId 分片 ID
   */
  removeShard(shardId: string): boolean {
    return this.router.removeShard(shardId);
  }

  /**
   * 获取哈希环统计
   */
  getRingStats() {
    return this.router.getRingStats();
  }

  /**
   * 获取所有分片
   */
  getShards(): ShardInfo[] {
    return this.router.getShards();
  }
}

// ─────────────────────────────────────────────
// 便利函数
// ─────────────────────────────────────────────

/**
 * 创建默认分层存储（仅内存）
 * @param ttlSeconds Hot 层 TTL
 * @returns TieredStorage 实例
 */
export function createDefaultStorage(ttlSeconds = 3600): TieredStorage {
  return new TieredStorage({
    adapters: [new MemoryAdapter(ttlSeconds)],
  });
}
