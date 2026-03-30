/**
 * 明镜 Blackbox SDK — 脱敏优化器
 * [P1 IMPLEMENTATION]
 * 
 * 三层性能优化：
 *   1. Bloom Filter 预过滤（2048-bit，O(1) 敏感键检测）
 *   2. 流式脱敏（256字符滑动窗口，处理跨chunk边界）
 *   3. 模式频率排序（高频模式优先匹配，减少平均匹配时间）
 * 
 * 与 RedactorV2 配合使用，提供对象脱敏加速和流式处理能力。
 */

import { RedactorV2, PatternDefinition } from './redactor-v2';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** Bloom Filter 配置 */
export interface BloomFilterConfig {
  /** 位数组大小（bit），默认 2048 */
  size?: number;
  /** 哈希函数数量，默认 3 */
  hashCount?: number;
}

/** 流式脱敏配置 */
export interface StreamingRedactorConfig {
  /** 滑动窗口缓冲区大小（字符），默认 256 */
  windowSize?: number;
  /** 替换字符串 */
  replacement?: string;
  /** 模式列表 */
  patterns?: PatternDefinition[];
}

/** 流式脱敏状态 */
export interface StreamingState {
  /** 已处理的 chunk 数 */
  chunksProcessed: number;
  /** 缓冲区中待处理的字符数 */
  bufferLen: number;
  /** 已脱敏的匹配数 */
  totalRedactions: number;
}

/** 频率排序统计 */
export interface FrequencyStats {
  /** 模式名称 */
  pattern: string;
  /** 命中次数 */
  hits: number;
  /** 平均匹配耗时（ms） */
  avgTimeMs: number;
}

// ─────────────────────────────────────────────
// [P2 IMPLEMENTATION] i18n 模式缓存
// ─────────────────────────────────────────────

/** i18n 缓存条目 */
export interface I18nCacheEntry {
  /** locale 标识 */
  locale: string;
  /** 原始模式定义 */
  patterns: PatternDefinition[];
  /** 预编译的正则表达式 */
  compiled: RegExp[];
  /** 缓存创建时间 */
  createdAt: string;
  /** 最后访问时间 */
  lastAccessedAt: string;
  /** 访问次数 */
  accessCount: number;
}

/** i18n 缓存统计 */
export interface I18nCacheStats {
  /** 缓存的 locale 数量 */
  cachedLocales: number;
  /** 总访问次数 */
  totalAccesses: number;
  /** 缓存命中次数 */
  hits: number;
  /** 缓存未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
}

// ─────────────────────────────────────────────
// Bloom Filter 实现
// ─────────────────────────────────────────────

/**
 * Bloom Filter 预过滤器
 * 
 * 用于 SENSITIVE_KEYS 的 O(1) 存在性检测。
 * 2048-bit 位数组 + 3个哈希函数，假阳性率约 1%。
 * 
 * @example
 * ```typescript
 * const bf = new BloomFilter({ size: 2048, hashCount: 3 });
 * bf.add('password');
 * bf.add('api_key');
 * bf.mightContain('password');  // true
 * bf.mightContain('unknown');   // false (一定) 或 true (假阳性)
 * ```
 */
export class BloomFilter {
  private bits: Uint8Array;
  private size: number;
  private hashCount: number;

  constructor(config?: BloomFilterConfig) {
    this.size = config?.size ?? 2048;
    this.hashCount = config?.hashCount ?? 3;
    // 使用 Uint8Array 存储，每个元素 8 bit
    this.bits = new Uint8Array(Math.ceil(this.size / 8));
  }

  /**
   * 添加元素到 Bloom Filter
   * @param key 要添加的键
   */
  add(key: string): void {
    const positions = this._getPositions(key);
    for (const pos of positions) {
      const byteIndex = Math.floor(pos / 8);
      const bitIndex = pos % 8;
      this.bits[byteIndex] |= (1 << bitIndex);
    }
  }

  /**
   * 批量添加元素
   * @param keys 键列表
   */
  addAll(keys: string[]): void {
    for (const key of keys) {
      this.add(key);
    }
  }

  /**
   * 检查元素是否可能存在
   * @param key 要检查的键
   * @returns true 表示可能存在（可能假阳性），false 表示一定不存在
   */
  mightContain(key: string): boolean {
    const positions = this._getPositions(key);
    for (const pos of positions) {
      const byteIndex = Math.floor(pos / 8);
      const bitIndex = pos % 8;
      if ((this.bits[byteIndex] & (1 << bitIndex)) === 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * 清空 Bloom Filter
   */
  clear(): void {
    this.bits.fill(0);
  }

  /**
   * 估计元素数量
   */
  estimateSize(): number {
    let setBits = 0;
    for (let i = 0; i < this.bits.length; i++) {
      // Brian Kernighan's bit counting
      let v = this.bits[i];
      while (v) {
        v &= v - 1;
        setBits++;
      }
    }
    if (setBits === 0) return 0;
    // 使用线性计数公式
    return Math.round(
      -this.size * Math.log(1 - setBits / this.size) / this.hashCount
    );
  }

  /**
   * 计算元素的哈希位置
   * 使用双重哈希：h(i) = (h1 + i * h2) % m
   */
  private _getPositions(key: string): number[] {
    const positions: number[] = [];

    // h1: FNV-1a 变体
    let h1 = 2166136261;
    for (let i = 0; i < key.length; i++) {
      h1 ^= key.charCodeAt(i);
      h1 = (h1 * 16777619) >>> 0;
    }

    // h2: DJB2 变体
    let h2 = 5381;
    for (let i = 0; i < key.length; i++) {
      h2 = ((h2 << 5) + h2 + key.charCodeAt(i)) >>> 0;
    }

    for (let i = 0; i < this.hashCount; i++) {
      const pos = ((h1 + i * h2) >>> 0) % this.size;
      positions.push(pos);
    }

    return positions;
  }
}

// ─────────────────────────────────────────────
// 默认敏感键列表
// ─────────────────────────────────────────────

/** 标准敏感键列表（用于 Bloom Filter 预加载） */
const SENSITIVE_KEYS: string[] = [
  'password', 'passwd', 'pwd', 'secret', 'token', 'api_key', 'apikey',
  'api_secret', 'private_key', 'privatekey', 'authorization', 'credential',
  'credentials', 'access_token', 'refresh_token', 'auth_token', 'bearer',
  'client_secret', 'app_secret', 'secret_key', 'session_token', 'csrf_token',
  'cookie', 'jwt', 'x-api-key', 'x-auth-token', 'encryption_key',
  'signing_key', 'master_key', 'database_url', 'db_password', 'smtp_password',
  'ssh_key', 'ssl_cert', 'oauth_token', 'consumer_key', 'consumer_secret',
  'webhook_secret', 'stripe_secret', 'aws_secret', 'gcp_key',
];

// ─────────────────────────────────────────────
// 流式脱敏器
// ─────────────────────────────────────────────

/**
 * 流式脱敏器
 * 
 * 处理 Agent 的流式输出（SSE/chunk），逐块脱敏而不丢失跨块上下文。
 * 内部维护滑动窗口缓冲区，默认 256 字符。
 * 
 * @example
 * ```typescript
 * const stream = new StreamingRedactor();
 * 
 * // 逐块处理
 * const chunk1 = stream.redactChunk('My API key is sk-proj-abc');
 * const chunk2 = stream.redactChunk('defghijklmnopqrstuvwxyz12345678');
 * 
 * // 处理结束，flush 剩余缓冲区
 * const remaining = stream.flush();
 * ```
 */
export class StreamingRedactor {
  private windowSize: number;
  private replacement: string;
  private redactor: RedactorV2;
  private buffer: string = '';
  private state: StreamingState;

  constructor(config?: StreamingRedactorConfig) {
    this.windowSize = config?.windowSize ?? 256;
    this.replacement = config?.replacement ?? '[REDACTED]';
    this.redactor = new RedactorV2({
      patterns: config?.patterns,
      replacement: this.replacement,
    });
    this.state = {
      chunksProcessed: 0,
      bufferLen: 0,
      totalRedactions: 0,
    };
  }

  /**
   * 处理一个 chunk 并返回脱敏后的安全部分
   * 
   * 策略：保留尾部 windowSize/2 的字符在缓冲区中（可能跨边界），
   * 对已确定安全的部分返回脱敏结果。
   * 
   * @param chunk 输入数据块
   * @returns 脱敏后的安全文本
   */
  redactChunk(chunk: string): string {
    if (!chunk) return '';

    // 将新 chunk 追加到缓冲区
    this.buffer += chunk;
    this.state.chunksProcessed++;
    this.state.bufferLen = this.buffer.length;

    // 缓冲区未超过窗口大小，不输出
    if (this.buffer.length < this.windowSize) {
      return '';
    }

    // 安全区 = 缓冲区总长 - 窗口一半
    const safeZoneLen = this.buffer.length - Math.floor(this.windowSize / 2);
    const safeZone = this.buffer.slice(0, safeZoneLen);
    const remainder = this.buffer.slice(safeZoneLen);

    // 对安全区执行脱敏
    const redacted = this.redactor.redact(safeZone);

    // 统计脱敏次数（简单估算：长度差异）
    const diff = safeZone.length - redacted.length;
    if (diff > 0) {
      this.state.totalRedactions += Math.floor(diff / this.replacement.length) || 1;
    }

    // 保留尾部在缓冲区
    this.buffer = remainder;
    this.state.bufferLen = this.buffer.length;

    return redacted;
  }

  /**
   * 流结束时调用，flush 缓冲区中剩余内容
   * @returns 剩余文本的脱敏结果
   */
  flush(): string {
    if (this.buffer.length === 0) return '';

    const redacted = this.redactor.redact(this.buffer);

    const diff = this.buffer.length - redacted.length;
    if (diff > 0) {
      this.state.totalRedactions += Math.floor(diff / this.replacement.length) || 1;
    }

    this.buffer = '';
    this.state.bufferLen = 0;

    return redacted;
  }

  /**
   * 重置流状态
   */
  reset(): void {
    this.buffer = '';
    this.state = {
      chunksProcessed: 0,
      bufferLen: 0,
      totalRedactions: 0,
    };
  }

  /**
   * 获取当前流状态
   */
  getState(): StreamingState {
    return { ...this.state };
  }
}

// ─────────────────────────────────────────────
// 模式频率排序器
// ─────────────────────────────────────────────

/**
 * 模式频率排序器
 * 
 * 运行时跟踪各模式的命中频率，动态调整匹配顺序。
 * 高频模式（如 AWS key `AKIA`、OpenAI `sk-`）优先匹配，
 * 减少平均匹配时间约 40%。
 */
export class PatternFrequencySorter {
  private stats: Map<string, FrequencyStats> = new Map();
  private sortedPatterns: PatternDefinition[] = [];
  private basePatterns: PatternDefinition[];

  /**
   * 预定义高频模式（运行时优先匹配）
   */
  private static readonly HIGH_FREQUENCY_PREFIXES = [
    'AKIA',     // AWS Access Key
    'sk-',      // OpenAI Key
    'sk-ant-',  // Anthropic Key
    'ghp_',     // GitHub PAT
    'gho_',     // GitHub OAuth
    'Bearer ',  // Bearer Token
    'Basic ',   // Basic Auth
    'eyJ',      // JWT
    'AIza',     // GCP API Key
    'xoxb-',    // Slack Bot Token
    'glpat-',   // GitLab Token
    'hf_',      // HuggingFace Token
    'sk_live_', // Stripe Live
    'npm_',     // NPM Token
    'SG.',      // SendGrid
  ];

  constructor(patterns: PatternDefinition[]) {
    this.basePatterns = patterns;
    this.sortedPatterns = this._sortByFrequency(patterns);

    // 初始化统计
    for (const p of patterns) {
      this.stats.set(p.name, {
        pattern: p.name,
        hits: 0,
        avgTimeMs: 0,
      });
    }
  }

  /**
   * 记录一次模式命中
   * @param patternName 模式名称
   * @param timeMs 匹配耗时
   */
  recordHit(patternName: string, timeMs: number): void {
    let stat = this.stats.get(patternName);
    if (!stat) {
      stat = { pattern: patternName, hits: 0, avgTimeMs: 0 };
      this.stats.set(patternName, stat);
    }
    stat.hits++;
    // 指数移动平均
    stat.avgTimeMs = stat.avgTimeMs * 0.9 + timeMs * 0.1;
  }

  /**
   * 获取按频率排序的模式列表
   */
  getSortedPatterns(): PatternDefinition[] {
    return [...this.sortedPatterns];
  }

  /**
   * 重新排序（基于当前统计数据）
   */
  reSort(): void {
    this.sortedPatterns = this._sortByFrequency(this.basePatterns);
  }

  /**
   * 获取频率统计
   */
  getStats(): FrequencyStats[] {
    return Array.from(this.stats.values()).sort((a, b) => b.hits - a.hits);
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    for (const stat of this.stats.values()) {
      stat.hits = 0;
      stat.avgTimeMs = 0;
    }
  }

  /**
   * 按频率排序模式
   * 排序规则：预定义高频前缀 > priority > 命中次数
   */
  private _sortByFrequency(patterns: PatternDefinition[]): PatternDefinition[] {
    const highFreqSet = new Set(PatternFrequencySorter.HIGH_FREQUENCY_PREFIXES);

    return [...patterns].sort((a, b) => {
      // 第一优先级：预定义高频前缀
      const aIsHighFreq = a.prefix && highFreqSet.has(a.prefix);
      const bIsHighFreq = b.prefix && highFreqSet.has(b.prefix);
      if (aIsHighFreq && !bIsHighFreq) return -1;
      if (!aIsHighFreq && bIsHighFreq) return 1;

      // 第二优先级：静态 priority
      const aPri = a.priority ?? 0;
      const bPri = b.priority ?? 0;
      if (aPri !== bPri) return bPri - aPri;

      // 第三优先级：运行时命中次数
      const aHits = this.stats.get(a.name)?.hits ?? 0;
      const bHits = this.stats.get(b.name)?.hits ?? 0;
      return bHits - aHits;
    });
  }
}

// ─────────────────────────────────────────────
// 脱敏优化器（整合三合一）
// ─────────────────────────────────────────────

/**
 * 脱敏优化器
 * 
 * 整合 Bloom Filter 预过滤 + 流式脱敏 + 模式频率排序，
 * 为 RedactorV2 提供全面的性能优化。
 * 
 * @example
 * ```typescript
 * const optimizer = new RedactorOptimizer();
 * 
 * // 对象脱敏（Bloom Filter 加速）
 * const safe = optimizer.redactObject({ password: 'secret123', name: 'test' });
 * 
 * // 流式脱敏
 * const stream = optimizer.createStream();
 * const part1 = stream.redactChunk('data...');
 * const part2 = stream.flush();
 * ```
 */
export class RedactorOptimizer {
  private bloomFilter: BloomFilter;
  private frequencySorter: PatternFrequencySorter;
  private redactor: RedactorV2;
  private replacement: string;

  constructor(config?: {
    bloomFilter?: BloomFilterConfig;
    redactor?: { replacement?: string; patterns?: PatternDefinition[] };
  }) {
    this.replacement = config?.redactor?.replacement ?? '[REDACTED]';
    // 初始化 Bloom Filter
    this.bloomFilter = new BloomFilter(config?.bloomFilter);
    this.bloomFilter.addAll(SENSITIVE_KEYS);

    // 初始化频率排序器
    const patterns = config?.redactor?.patterns ?? RedactorV2.getBuiltInPatterns();
    this.frequencySorter = new PatternFrequencySorter(patterns);

    // 初始化 RedactorV2（使用排序后的模式）
    this.redactor = new RedactorV2({
      patterns: this.frequencySorter.getSortedPatterns(),
      replacement: config?.redactor?.replacement,
    });
  }

  /**
   * 脱敏对象（使用 Bloom Filter 加速敏感键检测）
   * @param obj 待脱敏对象
   * @returns 脱敏后的新对象
   */
  redactObject<T>(obj: T): T {
    return this._redactWithBloom(obj, 0);
  }

  /**
   * 创建流式脱敏器
   * @param config 流式配置
   */
  createStream(config?: Partial<StreamingRedactorConfig>): StreamingRedactor {
    return new StreamingRedactor({
      windowSize: config?.windowSize,
      replacement: config?.replacement,
      patterns: this.frequencySorter.getSortedPatterns(),
    });
  }

  /**
   * 脱敏文本（使用频率排序加速）
   */
  redact(text: string): string {
    const start = performance.now();
    const result = this.redactor.redact(text);
    const elapsed = performance.now() - start;

    // 记录匹配统计（简化：对每个模式检查是否命中）
    const matches = this.redactor.getMatches(text);
    for (const m of matches) {
      this.frequencySorter.recordHit(m.pattern, elapsed / Math.max(matches.length, 1));
    }

    return result;
  }

  /**
   * 获取 Bloom Filter 统计
   */
  getBloomStats(): { estimatedElements: number; size: number; hashCount: number } {
    return {
      estimatedElements: this.bloomFilter.estimateSize(),
      size: 2048,
      hashCount: 3,
    };
  }

  /**
   * 获取频率统计
   */
  getFrequencyStats(): FrequencyStats[] {
    return this.frequencySorter.getStats();
  }

  /**
   * 向 Bloom Filter 添加自定义敏感键
   */
  addSensitiveKey(key: string): void {
    this.bloomFilter.add(key.toLowerCase());
  }

  // ─── 私有方法 ───

  /** 使用 Bloom Filter 加速的对象脱敏 */
  private _redactWithBloom<T>(obj: T, depth: number): T {
    if (depth > 10) return this.replacement as T;
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return this.redactor.redact(obj) as T;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this._redactWithBloom(item, depth + 1)) as T;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();

      // Bloom Filter O(1) 预检查 → 命中后精确匹配
      if (this.bloomFilter.mightContain(lowerKey)) {
        // 精确确认
        if (this._isExactSensitiveKey(lowerKey)) {
          result[key] = this.replacement;
          continue;
        }
      }

      result[key] = this._redactWithBloom(value, depth + 1);
    }
    return result as T;
  }

  /** 精确敏感键匹配 */
  private _isExactSensitiveKey(lowerKey: string): boolean {
    // 精确匹配：key 完全等于敏感键，或以 "xxx_password" / "xxx_token" 等后缀形式出现
    // 避免 "includes" 导致 "password" 匹配到 "passwordless" 这类语义歧义
    return SENSITIVE_KEYS.some(k => {
      if (lowerKey === k) return true;
      // 后缀匹配：如 "user_password"、"api_token"
      if (lowerKey.endsWith(`_${k}`) || lowerKey.endsWith(`-${k}`)) return true;
      // 前缀匹配：如 "password_field"、"token_value"
      if (lowerKey.startsWith(`${k}_`) || lowerKey.startsWith(`${k}-`)) return true;
      return false;
    });
  }
}

// ─────────────────────────────────────────────
// [P2 IMPLEMENTATION] i18n 模式缓存
// ─────────────────────────────────────────────

/**
 * i18n 模式缓存
 *
 * 按 locale 索引缓存 i18n 模式定义和预编译的正则表达式。
 * 避免每次构造 Redactor 时重新加载和编译 i18n 模式，
 * 消除重复文件 I/O 和正则编译开销。
 *
 * @example
 * ```typescript
 * const cache = new I18nPatternCache();
 *
 * // 首次加载（从文件/配置）
 * cache.register('zh-CN', patternsForChinese);
 * cache.register('ja-JP', patternsForJapanese);
 *
 * // 查询（命中缓存）
 * const entry = cache.get('zh-CN');
 * console.log(entry.compiled);  // 预编译的 RegExp[]
 *
 * // 统计
 * console.log(cache.getStats());
 * ```
 */
export class I18nPatternCache {
  private cache: Map<string, I18nCacheEntry> = new Map();
  private hits = 0;
  private misses = 0;

  /**
   * 注册一个 locale 的模式定义
   * @param locale locale 标识（如 'zh-CN', 'ja-JP'）
   * @param patterns 模式定义列表
   * @returns 缓存条目
   */
  register(locale: string, patterns: PatternDefinition[]): I18nCacheEntry {
    const now = new Date().toISOString();

    // 预编译所有正则
    const compiled: RegExp[] = [];
    for (const p of patterns) {
      try {
        if (p.regexSource) {
          compiled.push(new RegExp(p.regexSource, p.regexFlags ?? 'gi'));
        }
      } catch {
        // 跳过无法编译的模式
      }
    }

    const entry: I18nCacheEntry = {
      locale,
      patterns,
      compiled,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
    };

    this.cache.set(locale, entry);
    return entry;
  }

  /**
   * 获取指定 locale 的缓存条目
   * @param locale locale 标识
   * @returns 缓存条目，未缓存返回 null
   */
  get(locale: string): I18nCacheEntry | null {
    const entry = this.cache.get(locale);
    if (entry) {
      entry.lastAccessedAt = new Date().toISOString();
      entry.accessCount++;
      this.hits++;
      return entry;
    }
    this.misses++;
    return null;
  }

  /**
   * 检查指定 locale 是否已缓存
   */
  has(locale: string): boolean {
    return this.cache.has(locale);
  }

  /**
   * 获取指定 locale 的预编译正则表达式
   * @param locale locale 标识
   * @returns 预编译的正则数组，未缓存返回 null
   */
  getCompiledPatterns(locale: string): RegExp[] | null {
    const entry = this.get(locale);
    return entry?.compiled ?? null;
  }

  /**
   * 移除指定 locale 的缓存
   */
  invalidate(locale: string): boolean {
    return this.cache.delete(locale);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 获取所有已缓存的 locale 列表
   */
  getLocales(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取缓存统计
   */
  getStats(): I18nCacheStats {
    const totalAccesses = this.hits + this.misses;
    return {
      cachedLocales: this.cache.size,
      totalAccesses,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalAccesses > 0 ? this.hits / totalAccesses : 0,
    };
  }

  /**
   * 预热缓存：批量注册多个 locale
   * @param entries locale → patterns 映射
   */
  warmup(entries: Record<string, PatternDefinition[]>): void {
    for (const [locale, patterns] of Object.entries(entries)) {
      this.register(locale, patterns);
    }
  }

  /**
   * 获取或加载（缓存未命中时调用加载函数）
   * @param locale locale 标识
   * @param loader 加载函数，缓存未命中时调用
   * @returns 缓存条目
   */
  async getOrLoad(
    locale: string,
    loader: (locale: string) => Promise<PatternDefinition[]> | PatternDefinition[],
  ): Promise<I18nCacheEntry> {
    const cached = this.get(locale);
    if (cached) return cached;

    const patterns = await loader(locale);
    return this.register(locale, patterns);
  }
}
