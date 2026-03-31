/**
 * MirrorAI Guard — 实时输入过滤层
 * 在 Agent 接收用户输入前进行安全检测
 */

import { Redactor } from './redactor';
import { ResponseAnalyzer } from './response-analyzer';

export type GuardDecision = 'allow' | 'block' | 'flag';

export interface GuardResult {
  decision: GuardDecision;
  originalInput: string;
  sanitizedInput: string;
  reasons: string[];
  riskScore: number; // 0-100
  metadata: Record<string, unknown>;
}

export interface GuardConfig {
  // 是否阻止提示注入
  blockPromptInjection: boolean;
  // 是否阻止越狱尝试
  blockJailbreak: boolean;
  // 是否脱敏输入中的 PII
  redactPII: boolean;
  // 风险阈值（超过则 block）
  blockThreshold: number; // 0-100, default 80
  // 标记阈值（超过则 flag）
  flagThreshold: number; // 0-100, default 50
  // 自定义黑名单关键词
  blacklist: string[];
  // 自定义白名单关键词
  whitelist: string[];
}

const DEFAULT_CONFIG: GuardConfig = {
  blockPromptInjection: true,
  blockJailbreak: true,
  redactPII: true,
  blockThreshold: 80,
  flagThreshold: 50,
  blacklist: [],
  whitelist: [],
};

// 提示注入检测模式
const INJECTION_PATTERNS = [
  { pattern: /ignore\s+(all\s+)?previous\s+instructions?/i, name: 'ignore_instructions', weight: 90 },
  { pattern: /disregard\s+(all\s+)?prior\s+commands?/i, name: 'disregard_commands', weight: 90 },
  { pattern: /you\s+are\s+now\s+(a|an)\s+/i, name: 'role_override', weight: 85 },
  { pattern: /system\s*prompt\s*[:=]/i, name: 'system_prompt_leak', weight: 80 },
  { pattern: /\[INST\]|\[\/INST\]|<\|im_start\|>/i, name: 'token_injection', weight: 95 },
  { pattern: /pretend\s+(you\s+are|to\s+be)/i, name: 'pretend', weight: 70 },
  { pattern: /act\s+as\s+(a|an)\s+/i, name: 'act_as', weight: 75 },
  { pattern: /do\s+not\s+follow\s+(any\s+)?rules?/i, name: 'no_rules', weight: 85 },
  { pattern: /override\s+(your|all)\s+(safety\s+)?(guidelines?|rules?|restrictions?)/i, name: 'override_safety', weight: 90 },
  { pattern: /DAN|do\s+anything\s+now/i, name: 'dan_jailbreak', weight: 95 },
  { pattern: /jailbreak|jail\s+break/i, name: 'jailbreak_keyword', weight: 80 },
  { pattern: /bypass\s+(all\s+)?(filters?|safety|restrictions?)/i, name: 'bypass', weight: 85 },
];

export class Guard {
  private config: GuardConfig;
  private redactor: Redactor;
  private analyzer: ResponseAnalyzer;

  constructor(config?: Partial<GuardConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.redactor = new Redactor();
    this.analyzer = new ResponseAnalyzer();
  }

  /**
   * 检查输入内容
   * @param input 用户输入
   * @returns GuardResult 包含决策、风险评分、原因
   */
  check(input: string): GuardResult {
    const reasons: string[] = [];
    let riskScore = 0;

    // Unicode 归一化 + 移除零宽字符
    const normalized = input
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
      .replace(/\s+/g, ' ');

    // 1. 检查提示注入
    if (this.config.blockPromptInjection) {
      for (const { pattern, name, weight } of INJECTION_PATTERNS) {
        if (pattern.test(normalized)) {
          reasons.push(`prompt_injection:${name}`);
          riskScore = Math.min(100, riskScore + weight);
        }
      }
    }

    // 2. 检查黑名单
    for (const keyword of this.config.blacklist) {
      if (normalized.toLowerCase().includes(keyword.toLowerCase())) {
        reasons.push(`blacklist:${keyword}`);
        riskScore = Math.min(100, riskScore + 70);
      }
    }

    // 3. 检查白名单（降低风险分）
    for (const keyword of this.config.whitelist) {
      if (normalized.toLowerCase().includes(keyword.toLowerCase())) {
        riskScore = Math.max(0, riskScore - 20);
      }
    }

    // 4. 脱敏
    let sanitizedInput = normalized;
    if (this.config.redactPII) {
      sanitizedInput = this.redactor.redactString(normalized);
    }

    // 5. 决策
    let decision: GuardDecision = 'allow';
    if (riskScore >= this.config.blockThreshold) {
      decision = 'block';
    } else if (riskScore >= this.config.flagThreshold) {
      decision = 'flag';
    }

    return {
      decision,
      originalInput: input,
      sanitizedInput,
      reasons,
      riskScore,
      metadata: {
        injectionDetected: reasons.some(r => r.startsWith('prompt_injection')),
        blacklisted: reasons.some(r => r.startsWith('blacklist')),
        piiRedacted: sanitizedInput !== normalized,
      },
    };
  }

  /**
   * 批量检查
   */
  checkBatch(inputs: string[]): GuardResult[] {
    return inputs.map(input => this.check(input));
  }
}
