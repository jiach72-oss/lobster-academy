/**
 * MirrorAI Gate — 工具调用权限网关
 * 在 Agent 执行工具调用前进行权限检查和阻断
 */

export type GateDecision = 'allow' | 'deny' | 'require_approval';

export interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
  agentId: string;
  timestamp: string;
}

export interface GateResult {
  decision: GateDecision;
  toolCall: ToolCall;
  reasons: string[];
  riskScore: number;
}

export interface ToolPermission {
  tool: string;
  allowed: boolean;
  maxCallsPerMinute?: number;
  requireApproval?: boolean;
  allowedParams?: string[];
  blockedParams?: string[];
}

export interface GateConfig {
  // 默认策略：allow 或 deny
  defaultPolicy: 'allow' | 'deny';
  // 工具权限列表
  permissions: ToolPermission[];
  // 高风险工具列表（需要审批）
  highRiskTools: string[];
  // 每分钟最大调用次数
  globalRateLimit: number;
}

const DEFAULT_CONFIG: GateConfig = {
  defaultPolicy: 'deny',
  permissions: [],
  highRiskTools: ['exec', 'shell', 'http_request', 'database_write', 'file_delete', 'send_email', 'transfer'],
  globalRateLimit: 60,
};

export class Gate {
  private config: GateConfig;
  private callCounts: Map<string, { count: number; resetAt: number }> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | undefined;

  constructor(config?: Partial<GateConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // 每5分钟清理过期条目
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.callCounts) {
        if (now > record.resetAt) {
          this.callCounts.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * 销毁定时器
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * 检查工具调用权限
   */
  check(call: ToolCall): GateResult {
    const reasons: string[] = [];
    let riskScore = 0;

    // 1. 查找权限配置
    const permission = this.config.permissions.find(p => p.tool === call.tool);

    // 2. 默认策略
    if (!permission) {
      if (this.config.defaultPolicy === 'deny') {
        return {
          decision: 'deny',
          toolCall: call,
          reasons: ['未授权的工具调用'],
          riskScore: 80,
        };
      }
    }

    // 3. 检查是否允许
    if (permission && !permission.allowed) {
      return {
        decision: 'deny',
        toolCall: call,
        reasons: [`工具 ${call.tool} 已被禁用`],
        riskScore: 90,
      };
    }

    // 4. 检查高风险工具
    if (this.config.highRiskTools.includes(call.tool)) {
      reasons.push(`高风险工具: ${call.tool}`);
      riskScore = Math.max(riskScore, 70);

      if (permission?.requireApproval) {
        return {
          decision: 'require_approval',
          toolCall: call,
          reasons,
          riskScore,
        };
      }
    }

    // 5. 检查速率限制
    const key = `${call.agentId}:${call.tool}`;
    const now = Date.now();
    const record = this.callCounts.get(key);
    const limit = permission?.maxCallsPerMinute || this.config.globalRateLimit;

    if (!record || now > record.resetAt) {
      this.callCounts.set(key, { count: 1, resetAt: now + 60000 });
    } else {
      record.count++;
      if (record.count > limit) {
        return {
          decision: 'deny',
          toolCall: call,
          reasons: [`速率限制: ${record.count}/${limit} 次/分钟`],
          riskScore: 60,
        };
      }
    }

    // 6. 检查参数
    if (permission?.blockedParams) {
      for (const param of permission.blockedParams) {
        if (param in call.params) {
          reasons.push(`禁止参数: ${param}`);
          riskScore = Math.max(riskScore, 80);
        }
      }
    }

    // 7. 决策
    let decision: GateDecision = 'allow';
    if (riskScore >= 80) {
      decision = 'deny';
    } else if (riskScore >= 60) {
      decision = 'require_approval';
    }

    return {
      decision,
      toolCall: call,
      reasons,
      riskScore,
    };
  }

  /**
   * 添加权限规则
   */
  addPermission(permission: ToolPermission): void {
    const idx = this.config.permissions.findIndex(p => p.tool === permission.tool);
    if (idx >= 0) {
      this.config.permissions[idx] = permission;
    } else {
      this.config.permissions.push(permission);
    }
  }
}
