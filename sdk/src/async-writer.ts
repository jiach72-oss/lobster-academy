/**
 * 明镜 Blackbox SDK — 异步批量写入器
 * [P1 IMPLEMENTATION]
 * 
 * 解耦 Agent 推理和事件持久化，提供：
 *   - 环形缓冲区（默认 1000 事件）+ 后台 flush
 *   - flush 策略：定时（100ms）/ 定量（50 事件）/ 手动
 *   - graceful shutdown：退出前 flush 全部
 *   - 增量压缩：对连续事件的重复内容做 delta encoding
 */

import { EventEmitter } from 'events';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 写入事件 */
export interface WriteEvent<T = unknown> {
  /** 事件 ID */
  id: string;
  /** 事件数据 */
  data: T;
  /** 时间戳 ISO8601 */
  timestamp: string;
  /** 元数据 */
  metadata?: Record<string, string>;
}

/** Flush 策略 */
export interface FlushPolicy {
  /** 定时 flush 间隔（ms），默认 100 */
  intervalMs?: number;
  /** 定量 flush 阈值（事件数），默认 50 */
  countThreshold?: number;
  /** 是否启用定时 flush，默认 true */
  enableTimer?: boolean;
}

/** 异步写入器配置 */
export interface AsyncWriterConfig<T = unknown> {
  /** 环形缓冲区大小，默认 1000 */
  bufferSize?: number;
  /** Flush 策略 */
  flush?: FlushPolicy;
  /** 后端写入函数 */
  writeFn: (events: WriteEvent<T>[]) => Promise<void>;
  /** 是否启用增量压缩，默认 false */
  enableCompression?: boolean;
  /** 错误处理 */
  onError?: (error: Error, events: WriteEvent<T>[]) => void;
}

/** 写入器统计 */
export interface WriterStats {
  /** 已写入事件总数 */
  totalWritten: number;
  /** 已 flush 次数 */
  flushCount: number;
  /** 当前缓冲区大小 */
  bufferSize: number;
  /** 缓冲区容量 */
  bufferCapacity: number;
  /** 最后一次 flush 时间 */
  lastFlushAt: string | null;
  /** 平均 flush 耗时（ms） */
  avgFlushMs: number;
  /** 写入失败次数 */
  writeErrors: number;
  /** 压缩比（启用压缩时） */
  compressionRatio: number;
}

// ─────────────────────────────────────────────
// [P2 IMPLEMENTATION] 分页查询
// ─────────────────────────────────────────────

/** 分页查询过滤条件 */
export interface QueryFilter {
  /** 元数据键值匹配 */
  metadata?: Record<string, string>;
  /** 时间范围 */
  from?: string;
  to?: string;
  /** 事件 ID 精确匹配 */
  id?: string;
}

/** 分页查询参数 */
export interface QueryParams {
  /** 页码（从 1 开始），默认 1 */
  page?: number;
  /** 每页大小，默认 50 */
  pageSize?: number;
  /** 过滤条件 */
  filters?: QueryFilter;
  /** 游标（基于时间戳的 ISO8601 字符串，用于游标分页） */
  cursor?: string;
  /** 排序方向，默认 'desc'（最新的在前） */
  order?: 'asc' | 'desc';
}

/** 分页元信息 */
export interface PaginationMeta {
  /** 当前页码 */
  page: number;
  /** 每页大小 */
  pageSize: number;
  /** 总记录数 */
  total: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrev: boolean;
  /** 下一页游标（基于时间戳） */
  nextCursor: string | null;
  /** 上一页游标 */
  prevCursor: string | null;
}

/** 分页查询结果 */
export interface PaginatedResult<T> {
  /** 当前页数据 */
  data: WriteEvent<T>[];
  /** 分页元信息 */
  pagination: PaginationMeta;
}

// ─────────────────────────────────────────────
// 环形缓冲区
// ─────────────────────────────────────────────

/**
 * 固定大小的环形缓冲区
 * 满时自动覆盖最旧条目
 */
class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0; // 写入位置
  private count = 0;
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /** 写入一个元素 */
  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /** 批量读取并清空 */
  drain(maxCount?: number): T[] {
    const count = maxCount !== undefined ? Math.min(maxCount, this.count) : this.count;
    const result: T[] = [];

    // 读取顺序：从最旧到最新
    const startIdx = this.count < this.capacity
      ? 0
      : this.head; // 缓冲区满时，head 指向最旧元素的下一个

    for (let i = 0; i < count; i++) {
      const idx = (startIdx + i) % this.capacity;
      const item = this.buffer[idx];
      if (item !== undefined) {
        result.push(item);
        this.buffer[idx] = undefined;
      }
    }

    this.count -= count;
    // 调整 head（如果读取了所有元素）
    if (this.count === 0) {
      this.head = 0;
    }

    return result;
  }

  /** 获取当前元素数 */
  get size(): number {
    return this.count;
  }

  /** 获取容量 */
  get cap(): number {
    return this.capacity;
  }

  /** 获取所有元素的副本（不修改缓冲区状态） */
  toArray(): T[] {
    const result: T[] = [];
    const startIdx = this.count < this.capacity
      ? 0
      : this.head;

    for (let i = 0; i < this.count; i++) {
      const idx = (startIdx + i) % this.capacity;
      const item = this.buffer[idx];
      if (item !== undefined) {
        result.push(item);
      }
    }

    return result;
  }

  /** 是否为空 */
  get isEmpty(): boolean {
    return this.count === 0;
  }

  /** 是否已满 */
  get isFull(): boolean {
    return this.count >= this.capacity;
  }
}

// ─────────────────────────────────────────────
// 增量压缩器
// ─────────────────────────────────────────────

/**
 * 简单增量压缩器
 * 对连续事件的相同字段做 diff，仅存储差异部分
 */
class DeltaCompressor {
  /**
   * 压缩事件批次
   * 仅对字符串字段做前后 diff
   */
  static compress<T extends Record<string, unknown>>(events: WriteEvent<T>[]): WriteEvent<T>[] {
    if (events.length <= 1) return events;

    const compressed: WriteEvent<T>[] = [events[0]]; // 第一个事件保留完整

    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1].data as Record<string, unknown>;
      const curr = events[i].data as Record<string, unknown>;

      const delta: Record<string, unknown> = {};
      for (const key of Object.keys(curr)) {
        const prevVal = prev[key];
        const currVal = curr[key];

        if (typeof currVal === 'string' && typeof prevVal === 'string') {
          // 简单的公共前缀压缩
          const commonLen = DeltaCompressor._commonPrefixLen(prevVal, currVal);
          if (commonLen > 20) {
            // 有显著公共前缀，存储 delta
            delta[key] = { __delta: true, prefix: commonLen, suffix: currVal.slice(commonLen) } as unknown;
          } else {
            delta[key] = currVal;
          }
        } else if (JSON.stringify(currVal) === JSON.stringify(prevVal)) {
          // 完全相同，标记为 unchanged
          delta[key] = { __unchanged: true };
        } else {
          delta[key] = currVal;
        }
      }

      compressed.push({
        ...events[i],
        data: delta as T,
      });
    }

    return compressed;
  }

  /**
   * 解压事件批次
   */
  static decompress<T extends Record<string, unknown>>(compressed: WriteEvent<T>[]): WriteEvent<T>[] {
    if (compressed.length <= 1) return compressed;

    const result: WriteEvent<T>[] = [compressed[0]];

    for (let i = 1; i < compressed.length; i++) {
      const prev = result[i - 1].data as Record<string, unknown>;
      const curr = compressed[i].data as Record<string, unknown>;

      const restored: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(curr)) {
        if (typeof val === 'object' && val !== null) {
          if ('__delta' in val) {
            // 还原 delta
            const prevStr = (prev[key] as string) ?? '';
            const deltaVal = val as unknown as { prefix: number; suffix: string };
            restored[key] = prevStr.slice(0, deltaVal.prefix) + deltaVal.suffix;
          } else if ('__unchanged' in val) {
            restored[key] = prev[key];
          } else {
            restored[key] = val;
          }
        } else {
          restored[key] = val;
        }
      }

      result.push({
        ...compressed[i],
        data: restored as T,
      });
    }

    return result;
  }

  /** 计算公共前缀长度 */
  private static _commonPrefixLen(a: string, b: string): number {
    const maxLen = Math.min(a.length, b.length);
    let i = 0;
    while (i < maxLen && a[i] === b[i]) i++;
    return i;
  }
}

// ─────────────────────────────────────────────
// 异步写入器主类
// ─────────────────────────────────────────────

/**
 * 异步批量写入器
 * 
 * 将事件写入环形缓冲区，由后台定时/定量 flush 到持久化后端。
 * Agent 的 `record()` 调用不再阻塞，延迟从 ~5-20ms 降至纳秒级。
 * 
 * @example
 * ```typescript
 * const writer = new AsyncWriter({
 *   bufferSize: 1000,
 *   flush: { intervalMs: 100, countThreshold: 50 },
 *   writeFn: async (events) => {
 *     await db.batchInsert(events);
 *   },
 * });
 * 
 * // 写入事件（非阻塞）
 * writer.write({ id: '1', data: { ... }, timestamp: new Date().toISOString() });
 * 
 * // graceful shutdown
 * await writer.shutdown();
 * ```
 */
export class AsyncWriter<T = unknown> extends EventEmitter {
  private buffer: RingBuffer<WriteEvent<T>>;
  private writeFn: (events: WriteEvent<T>[]) => Promise<void>;
  private flushPolicy: Required<FlushPolicy>;
  private enableCompression: boolean;
  private onError?: (error: Error, events: WriteEvent<T>[]) => void;

  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private shutdownRequested = false;

  private stats: WriterStats;

  constructor(config: AsyncWriterConfig<T>) {
    super();

    const bufferSize = config.bufferSize ?? 1000;
    this.buffer = new RingBuffer<WriteEvent<T>>(bufferSize);
    this.writeFn = config.writeFn;
    this.enableCompression = config.enableCompression ?? false;
    this.onError = config.onError;

    this.flushPolicy = {
      intervalMs: config.flush?.intervalMs ?? 100,
      countThreshold: config.flush?.countThreshold ?? 50,
      enableTimer: config.flush?.enableTimer ?? true,
    };

    this.stats = {
      totalWritten: 0,
      flushCount: 0,
      bufferSize: 0,
      bufferCapacity: bufferSize,
      lastFlushAt: null,
      avgFlushMs: 0,
      writeErrors: 0,
      compressionRatio: 1,
    };

    // 启动定时 flush
    if (this.flushPolicy.enableTimer) {
      this._startTimer();
    }
  }

  /**
   * 写入事件（非阻塞）
   * 将事件放入环形缓冲区，由后台 flush
   * @param event 写入事件
   */
  write(event: WriteEvent<T>): void {
    if (this.shutdownRequested) {
      this.emit('warn', 'Write after shutdown requested');
      return;
    }

    this.buffer.push(event);
    this.stats.totalWritten++;
    this.stats.bufferSize = this.buffer.size;

    // 定量 flush
    if (this.buffer.size >= this.flushPolicy.countThreshold) {
      this.flush().catch(err => {
        this.emit('error', err);
      });
    }
  }

  /**
   * 批量写入
   * @param events 事件数组
   */
  writeBatch(events: WriteEvent<T>[]): void {
    for (const event of events) {
      this.write(event);
    }
  }

  /**
   * 手动触发 flush
   * 将缓冲区中所有事件写入后端
   */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.isEmpty) return;

    this.flushing = true;
    const startMs = performance.now();
    let events: WriteEvent<T>[] = [];

    try {
      events = this.buffer.drain();
      if (events.length === 0) {
        this.flushing = false;
        return;
      }

      // 增量压缩
      let toWrite: WriteEvent<T>[] = events;
      if (this.enableCompression) {
        toWrite = DeltaCompressor.compress(events as WriteEvent<Record<string, unknown>>[]) as WriteEvent<T>[];
        const originalSize = JSON.stringify(events).length;
        const compressedSize = JSON.stringify(toWrite).length;
        this.stats.compressionRatio = originalSize > 0
          ? Math.round((1 - compressedSize / originalSize) * 100) / 100
          : 1;
      }

      await this.writeFn(toWrite);

      const elapsed = performance.now() - startMs;
      this.stats.flushCount++;
      this.stats.lastFlushAt = new Date().toISOString();
      this.stats.avgFlushMs = this.stats.avgFlushMs * 0.9 + elapsed * 0.1;
      this.stats.bufferSize = this.buffer.size;

      this.emit('flush', { count: events.length, elapsedMs: elapsed });
    } catch (err) {
      this.stats.writeErrors++;
      const error = err instanceof Error ? err : new Error(String(err));

      if (this.onError) {
        // 将失败的事件数据传入 onError 回调，方便调用方处理重试或死信
        this.onError(error, events);
      }

      this.emit('error', error);
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Graceful shutdown
   * 停止定时器，flush 全部缓冲区
   */
  async shutdown(): Promise<void> {
    this.shutdownRequested = true;

    // 停止定时器
    this._stopTimer();

    // flush 剩余数据
    if (!this.buffer.isEmpty) {
      await this.flush();
    }

    this.emit('shutdown');
  }

  /**
   * 获取统计信息
   */
  getStats(): WriterStats {
    return {
      ...this.stats,
      bufferSize: this.buffer.size,
      bufferCapacity: this.buffer.cap,
    };
  }

  // ─────────────────────────────────────────────
  // [P2 IMPLEMENTATION] 分页查询
  // ─────────────────────────────────────────────

  /**
   * 对缓冲区中已写入的事件进行分页查询
   *
   * 支持两种分页模式：
   * 1. 基于页码的分页（page + pageSize）
   * 2. 基于游标的分页（cursor + pageSize，适用于实时数据流）
   *
   * @param params 查询参数
   * @returns 分页结果
   *
   * @example
   * ```typescript
   * // 页码分页
   * const page1 = writer.query({ page: 1, pageSize: 20 });
   * console.log(page1.data);        // 第 1 页数据
   * console.log(page1.pagination);  // 分页元信息
   *
   * // 游标分页
   * const next = writer.query({ pageSize: 20, cursor: page1.pagination.nextCursor });
   * ```
   */
  query(params: QueryParams = {}): PaginatedResult<T> {
    const page = params.page ?? 1;
    const pageSize = Math.max(1, params.pageSize ?? 50);
    const order = params.order ?? 'desc';

    // 收集缓冲区中的所有事件
    let allEvents = this._collectAllEvents();

    // 应用过滤条件
    if (params.filters) {
      allEvents = this._applyFilters(allEvents, params.filters);
    }

    // 游标过滤：如果提供了 cursor，过滤出 cursor 之后/之前的事件
    if (params.cursor) {
      if (order === 'desc') {
        allEvents = allEvents.filter(e => e.timestamp < params.cursor!);
      } else {
        allEvents = allEvents.filter(e => e.timestamp > params.cursor!);
      }
    }

    // 排序
    allEvents.sort((a, b) => {
      if (order === 'desc') return b.timestamp.localeCompare(a.timestamp);
      return a.timestamp.localeCompare(b.timestamp);
    });

    const total = allEvents.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // 页码分页
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const data = allEvents.slice(startIndex, endIndex);

    // 计算游标
    const nextCursor = endIndex < total && data.length > 0 ? allEvents[endIndex - 1].timestamp : null;
    const prevCursor = startIndex > 0 && startIndex < total ? allEvents[startIndex - 1].timestamp : null;

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextCursor,
        prevCursor,
      },
    };
  }

  /**
   * 收集缓冲区中所有事件（不修改缓冲区状态）
   * 使用 toArray() 替代 drain-restore，避免 O(2N) 的开销
   * @private
   */
  private _collectAllEvents(): WriteEvent<T>[] {
    return this.buffer.toArray();
  }

  /**
   * 应用过滤条件
   * @private
   */
  private _applyFilters(events: WriteEvent<T>[], filters: QueryFilter): WriteEvent<T>[] {
    return events.filter(event => {
      // ID 过滤
      if (filters.id && event.id !== filters.id) return false;

      // 时间范围过滤
      if (filters.from && event.timestamp < filters.from) return false;
      if (filters.to && event.timestamp > filters.to) return false;

      // 元数据过滤
      if (filters.metadata) {
        for (const [key, value] of Object.entries(filters.metadata)) {
          if (event.metadata?.[key] !== value) return false;
        }
      }

      return true;
    });
  }

  /**
   * 更新 flush 策略
   */
  updatePolicy(policy: Partial<FlushPolicy>): void {
    if (policy.intervalMs !== undefined) {
      this.flushPolicy.intervalMs = policy.intervalMs;
    }
    if (policy.countThreshold !== undefined) {
      this.flushPolicy.countThreshold = policy.countThreshold;
    }
    if (policy.enableTimer !== undefined && policy.enableTimer !== this.flushPolicy.enableTimer) {
      this.flushPolicy.enableTimer = policy.enableTimer;
      if (policy.enableTimer) {
        this._startTimer();
      } else {
        this._stopTimer();
      }
    }

    // 重启定时器（间隔可能已变）
    if (this.flushPolicy.enableTimer && this.timer) {
      this._stopTimer();
      this._startTimer();
    }
  }

  /** 是否正在 flush */
  get isFlushing(): boolean {
    return this.flushing;
  }

  /** 是否已请求关闭 */
  get isShutdown(): boolean {
    return this.shutdownRequested;
  }

  // ─── 私有方法 ───

  private _startTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.flush().catch(err => {
        this.emit('error', err);
      });
    }, this.flushPolicy.intervalMs);
    // 不阻塞进程退出
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }
  }

  private _stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// ─────────────────────────────────────────────
// 导出便捷函数
// ─────────────────────────────────────────────

/**
 * 创建默认异步写入器
 * @param writeFn 后端写入函数
 * @param bufferSize 缓冲区大小
 * @returns AsyncWriter 实例
 */
export function createAsyncWriter<T>(
  writeFn: (events: WriteEvent<T>[]) => Promise<void>,
  bufferSize = 1000,
): AsyncWriter<T> {
  return new AsyncWriter<T>({
    bufferSize,
    writeFn,
    flush: {
      intervalMs: 100,
      countThreshold: 50,
      enableTimer: true,
    },
  });
}
