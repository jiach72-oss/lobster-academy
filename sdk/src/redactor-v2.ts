/**
 * 明镜 Blackbox SDK — Aho-Corasick 脱敏引擎 v2
 * 
 * 三层分层匹配架构：
 *   Tier 1: Aho-Corasick 多模式快速扫描（O(N+M)）
 *   Tier 2: 正则精确验证（仅对 AC 命中结果）
 *   Tier 3: 上下文边界校验（引号、等号等边界检测）
 * 
 * 相比原 Redactor 的 O(N×M) 逐正则匹配，长文本性能提升 10-50x
 */

import { createHash } from 'crypto';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 分层匹配结果 */
export interface TieredMatch {
  /** 匹配的模式名称 */
  pattern: string;
  /** 在文本中的起始位置 */
  start: number;
  /** 在文本中的结束位置（不含） */
  end: number;
  /** 匹配到的文本 */
  value: string;
  /** 置信度 */
  confidence: 'high' | 'medium' | 'low';
  /** 匹配层级 */
  tier: 1 | 2 | 3;
}

/** 模式定义 */
export interface PatternDefinition {
  /** 模式名称 */
  name: string;
  /** AC 快速扫描前缀（固定字符串） */
  prefix: string;
  /** 精确验证正则源码 */
  regexSource: string;
  /** 正则标志 */
  regexFlags: string;
  /** 优先级（越高越先匹配，默认 0） */
  priority?: number;
  /** 置信度 */
  confidence?: 'high' | 'medium' | 'low';
  /** 上下文边界字符（可选） */
  boundaryChars?: string[];
}

/** AC 引擎配置 */
export interface RedactorV2Config {
  /** 模式列表 */
  patterns?: PatternDefinition[];
  /** 替换字符串 */
  replacement?: string;
  /** 是否启用上下文边界校验 */
  enableBoundaryCheck?: boolean;
  /** 超时（毫秒） */
  timeoutMs?: number;
}

// ─────────────────────────────────────────────
// Aho-Corasick 自动机实现
// ─────────────────────────────────────────────

/** AC 自动机节点 */
interface ACNode {
  children: Map<string, number>;
  fail: number;
  outputs: number[]; // 模式索引列表
  depth: number;
}

/**
 * Aho-Corasick 多模式匹配自动机
 * 支持 O(N+M) 时间复杂度的多模式同时匹配
 */
export class AhoCorasick {
  private nodes: ACNode[] = [];
  private patterns: string[] = [];
  private built = false;

  constructor() {
    // 根节点
    this.nodes.push({ children: new Map(), fail: 0, outputs: [], depth: 0 });
  }

  /**
   * 添加模式到自动机
   * @param pattern 要匹配的字符串模式
   * @returns 模式索引
   */
  addPattern(pattern: string): number {
    if (this.built) {
      throw new Error('Cannot add patterns after build()');
    }
    const index = this.patterns.length;
    this.patterns.push(pattern);

    let current = 0;
    for (const ch of pattern) {
      let next = this.nodes[current].children.get(ch);
      if (next === undefined) {
        next = this.nodes.length;
        this.nodes.push({
          children: new Map(),
          fail: 0,
          outputs: [],
          depth: this.nodes[current].depth + 1,
        });
        this.nodes[current].children.set(ch, next);
      }
      current = next;
    }
    this.nodes[current].outputs.push(index);
    return index;
  }

  /**
   * 构建失败指针（BFS）
   * 必须在添加完所有模式后调用
   */
  build(): void {
    if (this.built) return;
    this.built = true;

    const queue: number[] = [];

    // 第一层子节点的 fail 指向根
    for (const [, child] of this.nodes[0].children) {
      this.nodes[child].fail = 0;
      queue.push(child);
    }

    // BFS 构建 fail 指针
    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = this.nodes[current];

      for (const [ch, child] of node.children) {
        queue.push(child);
        let fail = node.fail;
        while (fail !== 0 && !this.nodes[fail].children.has(ch)) {
          fail = this.nodes[fail].fail;
        }
        const failTarget = this.nodes[fail].children.get(ch);
        this.nodes[child].fail = failTarget ?? 0;

        // 合并输出（短模式也匹配）
        const failOutputs = this.nodes[this.nodes[child].fail].outputs;
        this.nodes[child].outputs = [...failOutputs, ...this.nodes[child].outputs];
      }
    }
  }

  /**
   * 在文本中搜索所有匹配
   * @param text 待搜索文本
   * @returns 匹配结果列表，每项包含模式索引、起始位置、结束位置
   */
  search(text: string): Array<{ patternIndex: number; start: number; end: number }> {
    if (!this.built) {
      throw new Error('Call build() before search()');
    }

    const results: Array<{ patternIndex: number; start: number; end: number }> = [];
    let current = 0;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      // 沿 fail 链回溯
      while (current !== 0 && !this.nodes[current].children.has(ch)) {
        current = this.nodes[current].fail;
      }

      const next = this.nodes[current].children.get(ch);
      current = next ?? 0;

      // 收集输出
      for (const idx of this.nodes[current].outputs) {
        const patLen = this.patterns[idx].length;
        results.push({
          patternIndex: idx,
          start: i - patLen + 1,
          end: i + 1,
        });
      }
    }

    return results;
  }

  /** 获取模式数量 */
  get size(): number {
    return this.patterns.length;
  }

  /** 获取指定索引的模式字符串 */
  getPattern(index: number): string {
    return this.patterns[index];
  }
}

// ─────────────────────────────────────────────
// 内置模式（从常见高优先级模式提取 AC 前缀）
// ─────────────────────────────────────────────

/** 内置分层模式定义 */
const BUILT_IN_TIERED_PATTERNS: PatternDefinition[] = [
  // ═══════════════════════════════════════════
  // 高频凭证前缀（AC 快速匹配）
  // ═══════════════════════════════════════════
  { name: 'aws-access-key', prefix: 'AKIA', regexSource: 'AKIA[0-9A-Z]{16}', regexFlags: '', priority: 10, confidence: 'high' },
  { name: 'aws-sts-key', prefix: 'ASIA', regexSource: 'ASIA[0-9A-Z]{16}', regexFlags: '', priority: 10, confidence: 'high' },
  { name: 'gcp-api-key', prefix: 'AIza', regexSource: 'AIza[0-9A-Za-z_-]{35}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'github-token', prefix: 'ghp_', regexSource: 'gh[ps]_[A-Za-z0-9_]{36,}', regexFlags: '', priority: 10, confidence: 'high' },
  { name: 'github-oauth', prefix: 'gho_', regexSource: 'gho_[A-Za-z0-9_]{36,}', regexFlags: '', priority: 10, confidence: 'high' },
  { name: 'github-fine-grained', prefix: 'github_pat_', regexSource: 'github_pat_[A-Za-z0-9_]{22}_[A-Za-z0-9_]{59,}', regexFlags: '', priority: 10, confidence: 'high' },
  { name: 'gitlab-token', prefix: 'glpat-', regexSource: 'glpat-[A-Za-z0-9_-]{20,}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'openai-key', prefix: 'sk-', regexSource: 'sk-[A-Za-z0-9]{48,}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'anthropic-key', prefix: 'sk-ant-', regexSource: 'sk-ant-[A-Za-z0-9_-]{40,}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'huggingface-token', prefix: 'hf_', regexSource: 'hf_[A-Za-z0-9]{34,}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'stripe-sk-live', prefix: 'sk_live_', regexSource: 'sk_live_[A-Za-z0-9]{24,}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'stripe-pk-live', prefix: 'pk_live_', regexSource: 'pk_live_[A-Za-z0-9]{24,}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'stripe-sk-test', prefix: 'sk_test_', regexSource: 'sk_test_[A-Za-z0-9]{24,}', regexFlags: '', priority: 8, confidence: 'high' },
  { name: 'stripe-webhook', prefix: 'whsec_', regexSource: 'whsec_[A-Za-z0-9]{32,}', regexFlags: '', priority: 8, confidence: 'high' },
  { name: 'sendgrid-api-key', prefix: 'SG.', regexSource: 'SG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'slack-bot-token', prefix: 'xoxb-', regexSource: 'xoxb-[0-9]{11,}-[A-Za-z0-9]{24,}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'slack-user-token', prefix: 'xoxp-', regexSource: 'xoxp-[0-9]{11,}-[A-Za-z0-9]{24,}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'slack-app-token', prefix: 'xapp-', regexSource: 'xapp-[0-9]-[A-Za-z0-9-]{35,}', regexFlags: '', priority: 8, confidence: 'high' },
  { name: 'npm-token', prefix: 'npm_', regexSource: 'npm_[A-Za-z0-9]{36}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'pypi-token', prefix: 'pypi-', regexSource: 'pypi-[A-Za-z0-9_-]{60,}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'digitalocean-token', prefix: 'dop_v1_', regexSource: 'dop_v1_[a-f0-9]{64}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'netlify-token', prefix: 'nfp_', regexSource: 'nfp_[A-Za-z0-9]{40,}', regexFlags: '', priority: 8, confidence: 'high' },
  // P0 FIX: Heroku API Key — 移除通用 UUID 匹配（太宽泛，所有 UUID 都会被脱敏）
  // 依赖 SENSITIVE_KEYS 中的字段名匹配
  // { name: 'heroku-api-key', prefix: '', regexSource: '[0-9a-fA-F]{8}-...', ... } — REMOVED
  { name: 'vault-token', prefix: 'hvs.', regexSource: 'hvs\\.[A-Za-z0-9_-]{24,}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'shopify-token', prefix: 'shpat_', regexSource: 'shpat_[a-fA-F0-9]{32}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'notion-token', prefix: 'secret_', regexSource: 'secret_[A-Za-z0-9]{43}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'linear-key', prefix: 'lin_api_', regexSource: 'lin_api_[A-Za-z0-9]{40,}', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'woocommerce-key', prefix: 'ck_', regexSource: 'ck_[a-f0-9]{40}', regexFlags: '', priority: 8, confidence: 'high' },
  { name: 'woocommerce-secret', prefix: 'cs_', regexSource: 'cs_[a-f0-9]{40}', regexFlags: '', priority: 8, confidence: 'high' },
  { name: 'bitbucket-app-pw', prefix: 'A', regexSource: 'A[ST]_[A-Za-z0-9]{20,}', regexFlags: '', priority: 5, confidence: 'medium' },

  // JWT
  { name: 'jwt', prefix: 'eyJ', regexSource: 'eyJ[A-Za-z0-9_-]*\\.eyJ[A-Za-z0-9_-]*\\.[A-Za-z0-9_-]*', regexFlags: '', priority: 8, confidence: 'high' },

  // 邮箱（高频）
  { name: 'email', prefix: '', regexSource: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', regexFlags: '', priority: 7, confidence: 'high', boundaryChars: [' ', '\t', '\n', '\r', '"', "'", '<', '>', ',', ';', '(', ')', '[', ']'] },

  // Bearer Token
  { name: 'bearer-token', prefix: 'Bearer ', regexSource: 'Bearer\\s+[A-Za-z0-9_\\-\\.]+', regexFlags: '', priority: 8, confidence: 'high' },

  // Basic Auth
  { name: 'basic-auth', prefix: 'Basic ', regexSource: 'Basic\\s+[A-Za-z0-9+/=]+', regexFlags: '', priority: 8, confidence: 'high' },

  // Private Key Markers
  { name: 'ssh-rsa-priv', prefix: '-----BEGIN RSA PRIVATE KEY-----', regexSource: '-----BEGIN RSA PRIVATE KEY-----[\\s\\S]*?-----END RSA PRIVATE KEY-----', regexFlags: '', priority: 10, confidence: 'high' },
  { name: 'ssh-openssh-priv', prefix: '-----BEGIN OPENSSH PRIVATE KEY-----', regexSource: '-----BEGIN OPENSSH PRIVATE KEY-----[\\s\\S]*?-----END OPENSSH PRIVATE KEY-----', regexFlags: '', priority: 10, confidence: 'high' },
  { name: 'pgp-priv-key', prefix: '-----BEGIN PGP PRIVATE KEY BLOCK-----', regexSource: '-----BEGIN PGP PRIVATE KEY BLOCK-----[\\s\\S]*?-----END PGP PRIVATE KEY BLOCK-----', regexFlags: '', priority: 10, confidence: 'high' },

  // Connection Strings
  { name: 'mysql-conn', prefix: 'mysql://', regexSource: 'mysql://[^@\\s]+@[^/\\s]+/[^\\s]+', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'postgres-conn', prefix: 'postgres://', regexSource: 'postgres(?:ql)?://[^@\\s]+@[^/\\s]+/[^\\s]+', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'mongodb-conn', prefix: 'mongodb://', regexSource: 'mongodb(?:\\+srv)?://[^@\\s]+@[^/\\s]+/[^\\s]*', regexFlags: '', priority: 9, confidence: 'high' },
  { name: 'redis-conn', prefix: 'redis://', regexSource: 'redis://[^@\\s]*@[^/\\s]+', regexFlags: '', priority: 9, confidence: 'high' },

  // URL Basic Auth
  { name: 'url-basic-auth', prefix: 'https://', regexSource: 'https?://[^:]+:[^@]+@[^\\s]+', regexFlags: '', priority: 7, confidence: 'high' },

  // Generic Patterns (低优先级，无固定前缀)
  { name: 'generic-api-key-eq', prefix: 'api_key=', regexSource: '(?:api[_-]?key|apikey|api[_-]?secret)\\s*[=:]\\s*[\'"]?[A-Za-z0-9_\\-]{20,}[\'"]?', regexFlags: 'i', priority: 6, confidence: 'medium' },
  { name: 'generic-token-eq', prefix: 'access_token=', regexSource: '(?:access[_-]?token|auth[_-]?token|bearer)\\s*[=:]\\s*[\'"]?[A-Za-z0-9_\\-\\.]{20,}[\'"]?', regexFlags: 'i', priority: 6, confidence: 'medium' },
  { name: 'generic-secret-eq', prefix: 'client_secret=', regexSource: '(?:client[_-]?secret|app[_-]?secret|secret[_-]?key)\\s*[=:]\\s*[\'"]?[A-Za-z0-9_\\-]{20,}[\'"]?', regexFlags: 'i', priority: 6, confidence: 'medium' },
  { name: 'generic-password-eq', prefix: 'password=', regexSource: '(?:password|passwd|pwd)\\s*[=:]\\s*[\'"]?[^\\s\'"]{8,}[\'"]?', regexFlags: 'i', priority: 6, confidence: 'medium' },

  // 信用卡
  { name: 'creditcard', prefix: '', regexSource: '\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}', regexFlags: '', priority: 5, confidence: 'medium', boundaryChars: [' ', '\t', '\n', '-', ':'] },
];

// ─────────────────────────────────────────────
// RedactorV2 主类
// ─────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_INPUT_LENGTH = 50_000;

/** RedactorV2 敏感键列表 */
const SENSITIVE_KEYS_V2 = [
  'password', 'secret', 'token', 'api_key', 'apikey', 'private_key', 'authorization', 'credential',
  'access_token', 'refresh_token', 'session_id', 'session_token', 'auth_token',
  'client_secret', 'client_id', 'app_secret', 'app_key',
  'aws_access_key', 'aws_secret', 'database_url', 'connection_string',
  'encryption_key', 'signing_key', 'webhook_secret', 'stripe_key',
];

/**
 * Aho-Corasick 分层脱敏引擎
 * 
 * 三层架构：
 * - Tier 1: AC 快速扫描（固定前缀模式）→ O(N+M)
 * - Tier 2: 正则精确验证（仅对 AC 命中结果）
 * - Tier 3: 上下文边界校验（引号、等号等边界检测）
 * 
 * @example
 * ```typescript
 * const redactor = new RedactorV2();
 * const result = redactor.redact('My AWS key is AKIAIOSFODNN7EXAMPLE');
 * // → 'My AWS key is [REDACTED]'
 * ```
 */
export class RedactorV2 {
  private ac: AhoCorasick;
  private patterns: PatternDefinition[];
  private regexCache: Map<string, RegExp>;
  private replacement: string;
  private enableBoundaryCheck: boolean;
  private timeoutMs: number;

  constructor(config?: RedactorV2Config) {
    this.replacement = config?.replacement ?? '[REDACTED]';
    this.enableBoundaryCheck = config?.enableBoundaryCheck ?? true;
    this.timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.regexCache = new Map();

    // 加载模式（按优先级排序，高频优先）
    const rawPatterns = config?.patterns ?? BUILT_IN_TIERED_PATTERNS;
    this.patterns = [...rawPatterns].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // 构建 AC 自动机（仅对有固定前缀的模式）
    this.ac = new AhoCorasick();
    for (const p of this.patterns) {
      if (p.prefix && p.prefix.length >= 2) {
        this.ac.addPattern(p.prefix);
      }
    }
    this.ac.build();

    // 预编译正则
    for (const p of this.patterns) {
      const flags = p.regexFlags || 'g';
      this.regexCache.set(p.name, new RegExp(p.regexSource, flags));
    }
  }

  /**
   * 脱敏文本（三层分层匹配）
   * @param text 待脱敏文本
   * @returns 脱敏后的文本
   */
  redact(text: string): string {
    if (typeof text !== 'string' || text.length === 0) return text;

    // 截断超长输入
    const input = text.length > MAX_INPUT_LENGTH ? text.slice(0, MAX_INPUT_LENGTH) : text;
    const deadline = Date.now() + this.timeoutMs;

    // Tier 1: AC 快速扫描
    const acMatches = this.ac.search(input);

    // 收集所有需要替换的区间
    const replacements: Array<{ start: number; end: number }> = [];

    // 对每个 AC 命中，执行 Tier 2 正则验证
    for (const acMatch of acMatches) {
      if (Date.now() > deadline) {
        console.error('[RedactorV2] Timeout during redaction');
        break;
      }

      const prefixPattern = this.ac.getPattern(acMatch.patternIndex);

      // 找到对应的模式定义
      const patternDef = this.patterns.find(p => p.prefix === prefixPattern);
      if (!patternDef) continue;

      const regex = this.regexCache.get(patternDef.name);
      if (!regex) continue;

      // [P0-1 FIX] 重置 lastIndex，防止 'g' flag 正则的全局状态污染
      regex.lastIndex = 0;

      // 在 AC 匹配附近搜索完整正则匹配
      const searchStart = Math.max(0, acMatch.start - 20);
      const searchEnd = Math.min(input.length, acMatch.end + 100);
      const searchText = input.slice(searchStart, searchEnd);
      const fullMatch = regex.exec(searchText);
      if (fullMatch) {
        const absStart = searchStart + fullMatch.index;
        const absEnd = absStart + fullMatch[0].length;

        // Tier 3: 上下文边界校验
        if (this.enableBoundaryCheck && patternDef.boundaryChars) {
          const before = absStart > 0 ? input[absStart - 1] : ' ';
          const after = absEnd < input.length ? input[absEnd] : ' ';
          if (!patternDef.boundaryChars.includes(before) && !patternDef.boundaryChars.includes(after)) {
            continue; // 边界不匹配，跳过
          }
        }

        replacements.push({ start: absStart, end: absEnd });
      }
    }

    // 对无前缀的模式（如 email、creditcard），直接正则匹配
    for (const patternDef of this.patterns) {
      if (patternDef.prefix && patternDef.prefix.length >= 2) continue; // 已在 AC 层处理
      if (Date.now() > deadline) break;

      const regex = this.regexCache.get(patternDef.name);
      if (!regex) continue;

      // [P0-1 FIX] 每次循环前重置 lastIndex，防止 'g' flag 正则状态从上次迭代残留
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(input)) !== null) {
        // 边界校验
        if (this.enableBoundaryCheck && patternDef.boundaryChars) {
          const before = match.index > 0 ? input[match.index - 1] : ' ';
          const after = match.index + match[0].length < input.length ? input[match.index + match[0].length] : ' ';
          if (!patternDef.boundaryChars.includes(before) && !patternDef.boundaryChars.includes(after)) {
            continue;
          }
        }
        replacements.push({ start: match.index, end: match.index + match[0].length });
      }
    }

    if (replacements.length === 0) return text;

    // 合并重叠区间并替换
    return this._applyReplacements(input, replacements);
  }

  /**
   * 脱敏对象（递归）
   * @param obj 待脱敏对象
   * @returns 脱敏后的新对象
   */
  redactObject<T>(obj: T): T {
    return this._redactObjectImpl(obj, 0);
  }

  /**
   * 检查文本是否包含敏感信息
   */
  hasPII(text: string): boolean {
    if (typeof text !== 'string') return false;
    const acMatches = this.ac.search(text);
    if (acMatches.length > 0) return true;

    // 检查无前缀模式
    for (const patternDef of this.patterns) {
      if (patternDef.prefix && patternDef.prefix.length >= 2) continue;
      const regex = this.regexCache.get(patternDef.name);
      if (!regex) continue;
      regex.lastIndex = 0;
      if (regex.test(text)) return true;
    }
    return false;
  }

  /**
   * 获取所有分层匹配结果（调试/分析用）
   */
  getMatches(text: string): TieredMatch[] {
    if (typeof text !== 'string') return [];

    const results: TieredMatch[] = [];
    const acMatches = this.ac.search(text);

    for (const acMatch of acMatches) {
      const prefixPattern = this.ac.getPattern(acMatch.patternIndex);
      const patternDef = this.patterns.find(p => p.prefix === prefixPattern);
      if (!patternDef) continue;

      const regex = this.regexCache.get(patternDef.name);
      if (!regex) continue;

      const searchStart = Math.max(0, acMatch.start - 20);
      const searchEnd = Math.min(text.length, acMatch.end + 100);
      const searchText = text.slice(searchStart, searchEnd);

      regex.lastIndex = 0;
      const fullMatch = regex.exec(searchText);
      if (fullMatch) {
        results.push({
          pattern: patternDef.name,
          start: searchStart + fullMatch.index,
          end: searchStart + fullMatch.index + fullMatch[0].length,
          value: fullMatch[0],
          confidence: patternDef.confidence ?? 'medium',
          tier: 2,
        });
      }
    }

    // 无前缀模式
    for (const patternDef of this.patterns) {
      if (patternDef.prefix && patternDef.prefix.length >= 2) continue;
      const regex = this.regexCache.get(patternDef.name);
      if (!regex) continue;
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        results.push({
          pattern: patternDef.name,
          start: match.index,
          end: match.index + match[0].length,
          value: match[0],
          confidence: patternDef.confidence ?? 'medium',
          tier: 1,
        });
      }
    }

    return results.sort((a, b) => a.start - b.start);
  }

  /** 获取已加载模式数量 */
  get patternCount(): number {
    return this.patterns.length;
  }

  /** 获取内置模式定义 */
  static getBuiltInPatterns(): PatternDefinition[] {
    return [...BUILT_IN_TIERED_PATTERNS];
  }

  // ─── 私有方法 ───

  private _redactObjectImpl<T>(obj: T, depth: number): T {
    if (depth > 10) return this.replacement as T;
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return this.redact(obj) as T;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this._redactObjectImpl(item, depth + 1)) as T;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // 简单敏感键检测
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS_V2.some(k => lowerKey.includes(k))) {
        result[key] = this.replacement;
      } else {
        result[key] = this._redactObjectImpl(value, depth + 1);
      }
    }
    return result as T;
  }

  private _applyReplacements(text: string, ranges: Array<{ start: number; end: number }>): string {
    if (ranges.length === 0) return text;

    // 按起始位置排序
    ranges.sort((a, b) => a.start - b.start);

    // 合并重叠区间
    const merged: Array<{ start: number; end: number }> = [ranges[0]];
    for (let i = 1; i < ranges.length; i++) {
      const last = merged[merged.length - 1];
      if (ranges[i].start <= last.end) {
        last.end = Math.max(last.end, ranges[i].end);
      } else {
        merged.push(ranges[i]);
      }
    }

    // 替换（从后往前，避免偏移）
    let result = text;
    for (let i = merged.length - 1; i >= 0; i--) {
      result = result.slice(0, merged[i].start) + this.replacement + result.slice(merged[i].end);
    }
    return result;
  }
}
