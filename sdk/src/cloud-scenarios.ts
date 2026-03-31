/**
 * 云端攻击库
 * 从 SaaS 平台拉取最新攻击场景
 */

import { AttackScenario } from './adversarial-engine';

export interface CloudScenarioConfig {
  baseUrl: string;
  apiKey: string;
  cacheTTL: number; // 缓存时间（毫秒）
}

export class CloudScenarioLibrary {
  private config: CloudScenarioConfig;
  private cache: AttackScenario[] | null = null;
  private cacheTime: number = 0;

  constructor(config: CloudScenarioConfig) {
    if (!config.baseUrl.startsWith('https://')) {
      throw new Error('CloudScenarioLibrary requires HTTPS baseUrl for API Key security');
    }
    this.config = config;
  }

  /**
   * 获取最新攻击场景（带缓存）
   */
  async getScenarios(): Promise<AttackScenario[]> {
    const now = Date.now();
    if (this.cache && now - this.cacheTime < this.config.cacheTTL) {
      return this.cache;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/sdk/scenarios`, {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      });

      if (response.ok) {
        const data = await response.json() as { scenarios: AttackScenario[] };
        this.cache = data.scenarios;
        this.cacheTime = now;
        return this.cache!;
      }
    } catch (error) {
      console.warn('Failed to fetch cloud scenarios, using cache:', error);
    }

    return this.cache || [];
  }

  /**
   * 按类别获取
   */
  async getByCategory(category: string): Promise<AttackScenario[]> {
    const scenarios = await this.getScenarios();
    return scenarios.filter(s => s.category === category);
  }

  /**
   * 获取新增场景（与本地对比）
   */
  async getNewScenarios(localIds: string[]): Promise<AttackScenario[]> {
    const scenarios = await this.getScenarios();
    return scenarios.filter(s => !localIds.includes(s.id));
  }
}
