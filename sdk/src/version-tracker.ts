/**
 * Agent 版本追踪器
 * 检测 Agent 的模型/工具/配置变更
 */

import * as crypto from 'crypto';

export interface AgentSnapshot {
  agentId: string;
  timestamp: string;
  model: string;
  modelVersion?: string;
  tools: string[];
  config: Record<string, unknown>;
  fingerprint: string;
}

export interface VersionDiff {
  modelChanged: { from: string; to: string } | null;
  toolsAdded: string[];
  toolsRemoved: string[];
  configChanges: { key: string; from: unknown; to: unknown }[];
  riskLevel: 'low' | 'medium' | 'high';
}

export class VersionTracker {
  private snapshots: Map<string, AgentSnapshot[]> = new Map();
  private maxSnapshots: number;

  constructor(maxSnapshots = 1000) {
    this.maxSnapshots = maxSnapshots;
  }

  /**
   * 记录 Agent 快照
   */
  snapshot(agentId: string, data: Omit<AgentSnapshot, 'agentId' | 'timestamp' | 'fingerprint'>): AgentSnapshot {
    const fingerprint = crypto.createHash('sha256')
      .update(JSON.stringify({ model: data.model, tools: data.tools.sort(), config: data.config }))
      .digest('hex').slice(0, 16);

    const snap: AgentSnapshot = {
      agentId,
      timestamp: new Date().toISOString(),
      fingerprint,
      ...data,
    };

    if (!this.snapshots.has(agentId)) {
      this.snapshots.set(agentId, []);
    }
    this.snapshots.get(agentId)!.push(snap);

    // Enforce snapshot cap
    const snaps = this.snapshots.get(agentId)!;
    if (snaps.length > this.maxSnapshots) {
      snaps.splice(0, snaps.length - this.maxSnapshots);
    }

    return snap;
  }

  /**
   * 对比两个版本
   */
  diff(agentId: string): VersionDiff | null {
    const snaps = this.snapshots.get(agentId);
    if (!snaps || snaps.length < 2) return null;

    const prev = snaps[snaps.length - 2];
    const curr = snaps[snaps.length - 1];

    const modelChanged = prev.model !== curr.model
      ? { from: prev.model, to: curr.model }
      : null;

    const toolsAdded = curr.tools.filter(t => !prev.tools.includes(t));
    const toolsRemoved = prev.tools.filter(t => !curr.tools.includes(t));

    const configChanges: VersionDiff['configChanges'] = [];
    const allKeys = new Set([...Object.keys(prev.config), ...Object.keys(curr.config)]);
    for (const key of allKeys) {
      if (JSON.stringify(prev.config[key]) !== JSON.stringify(curr.config[key])) {
        configChanges.push({ key, from: prev.config[key], to: curr.config[key] });
      }
    }

    // 风险评估
    let riskLevel: VersionDiff['riskLevel'] = 'low';
    if (modelChanged || toolsRemoved.length > 0) riskLevel = 'high';
    else if (toolsAdded.length > 0 || configChanges.length > 2) riskLevel = 'medium';

    return { modelChanged, toolsAdded, toolsRemoved, configChanges, riskLevel };
  }

  /**
   * 获取版本历史
   */
  getHistory(agentId: string): AgentSnapshot[] {
    const snaps = this.snapshots.get(agentId);
    return snaps ? JSON.parse(JSON.stringify(snaps)) : [];
  }
}
