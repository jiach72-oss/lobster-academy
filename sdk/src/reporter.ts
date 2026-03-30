/**
 * 明镜 Blackbox SDK — Lobster Reporter
 * SDK ↔ 网站数据上报模块
 *
 * 负责将 SDK 的评测结果和行为数据上报到 MirrorAI 网站。
 * 支持注册、评测上报、批量行为同步、重试逻辑。
 */

import type { EvalRecord } from './types';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** SDK 注册请求 */
export interface RegisterRequest {
  agentName: string;
  framework: string;
  model: string;
  sdkVersion: string;
  userId: string;
}

/** SDK 注册响应 */
export interface RegisterResponse {
  success: boolean;
  agentId: string;
  apiKey: string;
  reportUrl: string;
  syncUrl: string;
  expiresAt: string;
  warning?: string;
}

/** 评测上报数据 */
export interface ReportPayload {
  agentId: string;
  scores: {
    total: number;
    grade: string;
  };
  dimensions: Record<string, { score: number; max: number }>;
  sessionId: string;
  timestamp: string;
  evalType?: 'full' | 'partial' | 'incremental';
}

/** 行为记录 */
export interface BehaviorRecord {
  type: string;
  agentId: string;
  sessionId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

/** 批量同步请求 */
export interface SyncPayload {
  agentId: string;
  records: BehaviorRecord[];
}

/** API 响应基类 */
export interface ApiResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Reporter 配置 */
export interface LobsterReporterConfig {
  /** API 基础 URL，如 https://lobster.example.com */
  apiUrl: string;
  /** API Key（首次注册后获得） */
  apiKey?: string;
  /** 用户 ID（注册时使用） */
  userId?: string;
  /** 最大重试次数，默认 3 */
  maxRetries?: number;
  /** 重试间隔基数（ms），默认 1000 */
  retryBaseDelayMs?: number;
}

// ─────────────────────────────────────────────
// Reporter 类
// ─────────────────────────────────────────────

/**
 * Lobster Reporter
 *
 * 将 SDK 数据上报到 MirrorAI 网站。
 *
 * @example
 * ```typescript
 * // 1. 注册
 * const reporter = new LobsterReporter({
 *   apiUrl: 'https://lobster.example.com',
 *   userId: 'user_123',
 * });
 * const regResult = await reporter.register({
 *   agentName: 'my-bot',
 *   framework: 'openclaw',
 *   model: 'gpt-4',
 *   sdkVersion: '1.0.0',
 * });
 *
 * // 2. 上报评测结果
 * await reporter.report(evalRecord);
 *
 * // 3. 批量同步行为数据
 * await reporter.sync([behaviorRecord1, behaviorRecord2]);
 * ```
 */
export class LobsterReporter {
  private apiUrl: string;
  private apiKey: string | undefined;
  private userId: string | undefined;
  private agentId: string | undefined;
  private maxRetries: number;
  private retryBaseDelayMs: number;

  constructor(config: LobsterReporterConfig) {
    if (!config.apiUrl) {
      throw new Error('apiUrl is required');
    }
    // 去掉末尾斜杠
    this.apiUrl = config.apiUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.userId = config.userId;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? 1000;
  }

  // ─────────────────────────────────────────────
  // 公开方法
  // ─────────────────────────────────────────────

  /**
   * 注册 SDK，获取 agentId 和 apiKey
   */
  async register(request: Omit<RegisterRequest, 'userId'>): Promise<RegisterResponse> {
    if (!this.userId) {
      throw new Error('userId is required for registration');
    }

    const payload: RegisterRequest = {
      ...request,
      userId: this.userId,
    };

    const result = await this.post<RegisterResponse>(
      `${this.apiUrl}/api/sdk/register`,
      payload,
      undefined // 注册时不需要 API Key
    );

    if (result.success && result.data) {
      this.agentId = result.data.agentId;
      this.apiKey = result.data.apiKey;
      return result.data;
    }

    throw new Error(result.error ?? 'Registration failed');
  }

  /**
   * 上报评测结果到网站
   */
  async report(evalRecord: EvalRecord, sessionId?: string): Promise<ApiResult> {
    if (!this.apiKey) {
      throw new Error('apiKey is required. Call register() first or provide apiKey in config.');
    }
    if (!this.agentId) {
      throw new Error('agentId is required. Call register() first.');
    }

    const payload: ReportPayload = {
      agentId: this.agentId,
      scores: {
        total: evalRecord.totalScore,
        grade: evalRecord.grade,
      },
      dimensions: evalRecord.dimensions,
      sessionId: sessionId ?? `sdk-${Date.now()}`,
      timestamp: evalRecord.timestamp,
      evalType: 'full',
    };

    const result = await this.postWithRetry(
      `${this.apiUrl}/api/sdk/report`,
      payload
    );

    return result;
  }

  /**
   * 批量同步行为数据到网站
   */
  async sync(records: BehaviorRecord[]): Promise<ApiResult> {
    if (!this.apiKey) {
      throw new Error('apiKey is required. Call register() first or provide apiKey in config.');
    }
    if (!this.agentId) {
      throw new Error('agentId is required. Call register() first.');
    }

    if (!Array.isArray(records) || records.length === 0) {
      return { success: true, data: { syncedCount: 0 } };
    }

    const payload: SyncPayload = {
      agentId: this.agentId,
      records,
    };

    const result = await this.postWithRetry(
      `${this.apiUrl}/api/sdk/sync`,
      payload
    );

    return result;
  }

  // ─────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────

  /** 获取当前 API Key */
  getApiKey(): string | undefined {
    return this.apiKey;
  }

  /** 获取当前 Agent ID */
  getAgentId(): string | undefined {
    return this.agentId;
  }

  /** 是否已配置认证信息 */
  isReady(): boolean {
    return !!(this.apiKey && this.agentId);
  }

  // ─────────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────────

  /**
   * 带重试的 POST 请求
   */
  private async postWithRetry<T = unknown>(
    url: string,
    body: unknown
  ): Promise<ApiResult<T>> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const result = await this.post<T>(url, body, this.apiKey);

      if (result.success) {
        return result;
      }

      lastError = result.error;

      // 4xx 客户端错误不重试（401/403/400 等）
      if (lastError?.includes('400') || lastError?.includes('401') || lastError?.includes('403')) {
        break;
      }

      // 等待后重试（指数退避）
      if (attempt < this.maxRetries) {
        const delay = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError ?? `Failed after ${this.maxRetries} retries`,
    };
  }

  /**
   * HTTP POST 请求
   */
  private async post<T = unknown>(
    url: string,
    body: unknown,
    apiKey?: string
  ): Promise<ApiResult<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${((data as any)?.error) || response.statusText}`,
        };
      }

      return {
        success: true,
        data: data as T,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 延迟工具函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
