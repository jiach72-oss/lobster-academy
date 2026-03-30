/**
 * 明镜 Blackbox SDK — Agent护照管理器
 * 
 * 护照系统为每个Agent生成唯一的身份凭证，
 * 基于指纹算法追踪Agent配置变更，自动触发复测。
 */

import { createHash, randomUUID } from 'crypto';
import { Signer } from './signer';
import {
  AgentPassport,
  AgentChange,
  AgentChangeType,
  EvalRecord,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// 指纹算法
// ─────────────────────────────────────────────────────────────────────────────

/** 指纹数据结构（用于确定性序列化） */
interface FingerprintData {
  framework: { name: string; version: string };
  model: { provider: string; name: string; version?: string };
  tools: Array<{ name: string; category: string; permissions: string[] }>;
  permissions: AgentPassport['permissions'];
}

/**
 * 序列化为确定性JSON（按key排序，数组按name排序）
 */
function deterministicSerialize(data: FingerprintData): string {
  // 对 tools 数组按 name 排序
  const sortedTools = [...data.tools].sort((a, b) => a.name.localeCompare(b.name));

  // 对每个 tool 的 permissions 排序
  const normalizedTools = sortedTools.map(t => ({
    name: t.name,
    category: t.category,
    permissions: [...t.permissions].sort(),
  }));

  // 对 permissions 数组字段排序
  const perms = {
    ...data.permissions,
    allowedDomains: [...data.permissions.allowedDomains].sort(),
    deniedDomains: [...data.permissions.deniedDomains].sort(),
  };

  // 构建确定性对象（key 按字母序）
  const deterministic: Record<string, unknown> = {
    framework: { name: data.framework.name, version: data.framework.version },
    model: { provider: data.model.provider, name: data.model.name },
    permissions: perms,
    tools: normalizedTools,
  };

  if (data.model.version) {
    deterministic.model = { ...deterministic.model as object, version: data.model.version };
  }

  return JSON.stringify(deterministic);
}

/**
 * 计算Agent指纹
 * 1. 序列化 { framework, model, tools, permissions } 为确定性JSON
 * 2. SHA256哈希
 * 3. 截取前16字符作为指纹
 */
function computeFingerprintHash(data: FingerprintData): string {
  const serialized = deterministicSerialize(data);
  const fullHash = createHash('sha256').update(serialized).digest('hex');
  return fullHash.substring(0, 16);
}

// ─────────────────────────────────────────────────────────────────────────────
// 护照管理器
// ─────────────────────────────────────────────────────────────────────────────

/** 护照创建配置 */
export interface PassportCreateConfig {
  agentId: string;
  framework: { name: string; version: string };
  model: { provider: string; name: string; version?: string };
  tools: Array<{ name: string; category: string; permissions: string[] }>;
  permissions: AgentPassport['permissions'];
  /** 过期时间（ISO8601，可选） */
  expiresAt?: string;
}

/**
 * Agent护照管理器
 * 
 * 负责创建、验证、追踪Agent护照和变更。
 * 
 * @example
 * ```typescript
 * const signer = new Signer(secretKey);
 * const pm = new PassportManager(signer);
 * 
 * const passport = pm.createPassport({
 *   agentId: 'my-agent-001',
 *   framework: { name: 'openclaw', version: '1.0.0' },
 *   model: { provider: 'anthropic', name: 'claude-3' },
 *   tools: [{ name: 'web-search', category: 'web-search', permissions: ['read'] }],
 *   permissions: {
 *     maxTokens: 100000,
 *     allowedDomains: ['*'],
 *     deniedDomains: [],
 *     maxExecutionTime: 30000,
 *     sandboxed: true,
 *   },
 * });
 * ```
 */
export class PassportManager {
  private signer: Signer;

  constructor(signer?: Signer) {
    this.signer = signer ?? new Signer();
  }

  /**
   * 创建Agent护照
   * @param config 护照配置
   * @returns 签名后的Agent护照
   */
  createPassport(config: PassportCreateConfig): AgentPassport {
    const now = new Date().toISOString();
    const passportId = randomUUID();

    // 构建护照骨架（不含fingerprint和signature）
    const passportWithoutFingerprint: Omit<AgentPassport, 'fingerprint' | 'signature'> = {
      passportId,
      agentId: config.agentId,
      framework: { ...config.framework },
      model: { ...config.model },
      tools: config.tools.map(t => ({ ...t, permissions: [...t.permissions] })),
      permissions: { ...config.permissions },
      createdAt: now,
      expiresAt: config.expiresAt,
    };

    // 计算指纹
    const fingerprint = this.computeFingerprint(passportWithoutFingerprint);

    // 组装完整护照
    const passport: AgentPassport = {
      ...passportWithoutFingerprint,
      fingerprint,
    };

    // 签名（如果密钥可用）
    if (this.signer.hasKey()) {
      // 签名时不包含signature字段
      const { signature: _sig, ...signData } = passport;
      passport.signature = this.signer.sign(JSON.stringify(signData));
    }

    return passport;
  }

  /**
   * 计算Agent指纹
   * @param passport 护照对象（不含fingerprint和signature）
   * @returns 16字符指纹
   */
  computeFingerprint(passport: Omit<AgentPassport, 'fingerprint' | 'signature'>): string {
    const data: FingerprintData = {
      framework: passport.framework,
      model: passport.model,
      tools: passport.tools,
      permissions: passport.permissions,
    };
    return computeFingerprintHash(data);
  }

  /**
   * 检测Agent配置变更
   * @param oldPassport 旧护照
   * @param newConfig 新配置（部分字段）
   * @returns 变更记录列表
   */
  detectChanges(oldPassport: AgentPassport, newConfig: Partial<AgentPassport>): AgentChange[] {
    const changes: AgentChange[] = [];
    const now = new Date().toISOString();

    // 计算新指纹
    const mergedData: Omit<AgentPassport, 'fingerprint' | 'signature'> = {
      passportId: newConfig.passportId ?? oldPassport.passportId,
      agentId: newConfig.agentId ?? oldPassport.agentId,
      framework: newConfig.framework ?? oldPassport.framework,
      model: newConfig.model ?? oldPassport.model,
      tools: newConfig.tools ?? oldPassport.tools,
      permissions: newConfig.permissions ?? oldPassport.permissions,
      createdAt: oldPassport.createdAt,
      expiresAt: newConfig.expiresAt ?? oldPassport.expiresAt,
    };
    const newFingerprint = this.computeFingerprint(mergedData);

    // 如果指纹没变，无需变更
    if (newFingerprint === oldPassport.fingerprint) {
      return changes;
    }

    // 检测框架升级
    if (newConfig.framework &&
        (newConfig.framework.name !== oldPassport.framework.name ||
         newConfig.framework.version !== oldPassport.framework.version)) {
      changes.push({
        changeId: randomUUID(),
        passportId: oldPassport.passportId,
        changeType: 'framework_upgrade',
        description: `Framework: ${oldPassport.framework.name}@${oldPassport.framework.version} → ${newConfig.framework.name}@${newConfig.framework.version}`,
        previousFingerprint: oldPassport.fingerprint,
        newFingerprint,
        timestamp: now,
      });
    }

    // 检测模型变更
    if (newConfig.model &&
        (newConfig.model.provider !== oldPassport.model.provider ||
         newConfig.model.name !== oldPassport.model.name ||
         newConfig.model.version !== oldPassport.model.version)) {
      changes.push({
        changeId: randomUUID(),
        passportId: oldPassport.passportId,
        changeType: 'model_upgrade',
        description: `Model: ${oldPassport.model.provider}/${oldPassport.model.name} → ${newConfig.model.provider}/${newConfig.model.name}`,
        previousFingerprint: oldPassport.fingerprint,
        newFingerprint,
        timestamp: now,
      });
    }

    // 检测工具变更
    if (newConfig.tools) {
      const oldToolNames = new Set(oldPassport.tools.map(t => t.name));
      const newToolNames = new Set(newConfig.tools.map(t => t.name));

      // 新增的工具
      for (const tool of newConfig.tools) {
        if (!oldToolNames.has(tool.name)) {
          changes.push({
            changeId: randomUUID(),
            passportId: oldPassport.passportId,
            changeType: 'tool_added',
            description: `Tool added: ${tool.name} (${tool.category})`,
            previousFingerprint: oldPassport.fingerprint,
            newFingerprint,
            timestamp: now,
          });
        }
      }

      // 移除的工具
      for (const tool of oldPassport.tools) {
        if (!newToolNames.has(tool.name)) {
          changes.push({
            changeId: randomUUID(),
            passportId: oldPassport.passportId,
            changeType: 'tool_removed',
            description: `Tool removed: ${tool.name} (${tool.category})`,
            previousFingerprint: oldPassport.fingerprint,
            newFingerprint,
            timestamp: now,
          });
        }
      }
    }

    // 检测配置变更（权限等）
    if (newConfig.permissions) {
      const old = oldPassport.permissions;
      const n = newConfig.permissions;
      const permChanges: string[] = [];

      if (n.maxTokens !== undefined && n.maxTokens !== old.maxTokens) {
        permChanges.push(`maxTokens: ${old.maxTokens} → ${n.maxTokens}`);
      }
      if (n.maxExecutionTime !== undefined && n.maxExecutionTime !== old.maxExecutionTime) {
        permChanges.push(`maxExecutionTime: ${old.maxExecutionTime} → ${n.maxExecutionTime}`);
      }
      if (n.sandboxed !== undefined && n.sandboxed !== old.sandboxed) {
        permChanges.push(`sandboxed: ${old.sandboxed} → ${n.sandboxed}`);
      }

      if (permChanges.length > 0) {
        changes.push({
          changeId: randomUUID(),
          passportId: oldPassport.passportId,
          changeType: 'config_changed',
          description: `Config changed: ${permChanges.join(', ')}`,
          previousFingerprint: oldPassport.fingerprint,
          newFingerprint,
          timestamp: now,
        });
      }
    }

    // 如果有变更但没有精确分类，添加通用配置变更
    if (changes.length === 0 && newFingerprint !== oldPassport.fingerprint) {
      changes.push({
        changeId: randomUUID(),
        passportId: oldPassport.passportId,
        changeType: 'config_changed',
        description: 'Configuration changed',
        previousFingerprint: oldPassport.fingerprint,
        newFingerprint,
        timestamp: now,
      });
    }

    // 签名所有变更
    if (this.signer.hasKey()) {
      for (const change of changes) {
        change.signature = this.signer.sign(JSON.stringify(change));
      }
    }

    return changes;
  }

  /**
   * 验证护照完整性
   * @param passport 要验证的护照
   * @param publicKey Ed25519公钥（base64）
   * @returns 签名是否有效且指纹正确
   */
  verifyPassport(passport: AgentPassport, publicKey: string): boolean {
    try {
      // 1. 验证指纹
      const { fingerprint, signature, ...rest } = passport;
      const expectedFingerprint = this.computeFingerprint(rest);
      if (fingerprint !== expectedFingerprint) {
        return false;
      }

      // 2. 验证签名
      if (signature) {
        const { signature: _sig, ...signData } = passport;
        return Signer.verify(JSON.stringify(signData), signature, publicKey);
      }

      // 无签名的护照，指纹正确即为有效
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查Agent是否需要复测
   * @param passport 当前护照
   * @param lastEval 上次评测记录（可为null）
   * @returns 是否需要复测、原因和范围
   */
  needsRetest(
    passport: AgentPassport,
    lastEval: EvalRecord | null,
  ): { needed: boolean; reason: string; scope: 'full' | 'partial' | 'none' } {
    // 首次评测，需要全量复测
    if (!lastEval) {
      return {
        needed: true,
        reason: 'No previous evaluation found',
        scope: 'full',
      };
    }

    // 检查是否过期
    if (passport.expiresAt) {
      const expiresAt = new Date(passport.expiresAt).getTime();
      if (Date.now() > expiresAt) {
        return {
          needed: true,
          reason: 'Passport has expired',
          scope: 'full',
        };
      }
    }

    // 检查评测是否过时（指纹变更后需要复测）
    // 如果没有签名中的指纹变更记录，我们通过比较Agent版本来判断
    if (passport.agentId && lastEval.agentVersion) {
      // 检查基础：评测是基于当前护照指纹的
      // 此处简化逻辑：如果上次评测距今超过30天，建议部分复测
      const lastEvalTime = new Date(lastEval.timestamp).getTime();
      const daysSinceEval = (Date.now() - lastEvalTime) / (1000 * 60 * 60 * 24);

      if (daysSinceEval > 90) {
        return {
          needed: true,
          reason: `Evaluation is ${Math.floor(daysSinceEval)} days old (>90 days)`,
          scope: 'full',
        };
      }

      if (daysSinceEval > 30) {
        return {
          needed: true,
          reason: `Evaluation is ${Math.floor(daysSinceEval)} days old (>30 days)`,
          scope: 'partial',
        };
      }
    }

    return {
      needed: false,
      reason: 'Evaluation is current',
      scope: 'none',
    };
  }
}
