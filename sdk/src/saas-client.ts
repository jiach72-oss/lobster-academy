export interface SaasClientConfig {
  apiKey: string;
  baseUrl: string;
}

export interface SyncResult {
  success: boolean;
  recordsSynced?: number;
  evalId?: string;
  reportId?: string;
  error?: string;
}

export class MirrorAIClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: SaasClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  private async request(path: string, method: string, body?: unknown, retries = 3): Promise<any> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        // P0 FIX: 30秒超时
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return response.json();
        }

        // P0 FIX: 429 Too Many Requests — 读取 Retry-After 头并等待后重试
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          let waitMs: number;
          if (retryAfter) {
            // Retry-After 可以是秒数或日期
            const asNumber = Number(retryAfter);
            if (!isNaN(asNumber)) {
              waitMs = asNumber * 1000;
            } else {
              const retryDate = new Date(retryAfter).getTime();
              waitMs = Math.max(0, retryDate - Date.now());
            }
          } else {
            // 无 Retry-After 头，使用指数退避
            waitMs = Math.pow(2, attempt) * 2000;
          }

          if (attempt < retries - 1) {
            console.warn(`[MirrorAIClient] 429 Rate Limited, waiting ${waitMs}ms before retry ${attempt + 1}/${retries}`);
            await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 60000))); // 最多等60秒
            continue;
          }

          const errData: any = await response.json().catch(() => ({ error: 'Rate limited' }));
          throw new Error(errData.error || `HTTP ${response.status} (Rate Limited)`);
        }

        // 4xx 不重试（除 429）
        if (response.status >= 400 && response.status < 500) {
          const errData: any = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errData.error || `HTTP ${response.status}`);
        }

        // 5xx 重试
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }

        const errData: any = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || `HTTP ${response.status}`);
      } catch (error: any) {
        // P0 FIX: 区分超时错误
        if (error.name === 'AbortError') {
          if (attempt < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            continue;
          }
          throw new Error('Request timeout after 30s');
        }
        if (attempt === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  async syncRecords(agentId: string, records: any[]): Promise<SyncResult> {
    try {
      const result = await this.request('/api/sdk/records', 'POST', {
        agentId,
        records: records.map(r => ({
          ...r,
          timestamp: r.timestamp || new Date().toISOString(),
        })),
      });
      return { success: true, recordsSynced: result.received };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async submitEvaluation(agentId: string, evalData: any): Promise<SyncResult> {
    try {
      const result = await this.request('/api/sdk/evaluations', 'POST', {
        agentId,
        ...evalData,
      });
      return { success: true, evalId: result.evaluationId };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async submitReport(agentId: string, report: any): Promise<SyncResult> {
    try {
      const result = await this.request('/api/sdk/reports', 'POST', {
        agentId,
        report,
      });
      return { success: true, reportId: result.reportId };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async verifyCertificate(certId: string): Promise<any> {
    return this.request(`/api/sdk/verify/${certId}`, 'GET');
  }
}
