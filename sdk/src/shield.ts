/**
 * MirrorAI Shield — 实时输出审查层
 * 在 Agent 输出到达用户前进行安全检测和脱敏
 */

import { RedactorV2 } from './redactor-v2';
import { HallucinationDetector, HallucinationResult } from './bayesian-scorer';

export type ShieldDecision = 'pass' | 'redact' | 'block' | 'warn';

export interface ShieldResult {
  decision: ShieldDecision;
  originalOutput: string;
  sanitizedOutput: string;
  detections: Detection[];
  riskScore: number;
}

export interface Detection {
  type: 'pii_leak' | 'hallucination' | 'harmful_content' | 'secret_leak' | 'prompt_leak';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  matchedContent?: string;
}

export interface ShieldConfig {
  // 是否检测 PII 泄露
  detectPII: boolean;
  // 是否检测幻觉
  detectHallucination: boolean;
  // 是否检测有害内容
  detectHarmful: boolean;
  // 是否检测密钥泄露
  detectSecrets: boolean;
  // 是否检测系统提示词泄露
  detectPromptLeak: boolean;
  // PII 泄露时的动作
  piiAction: 'redact' | 'block';
  // 幻觉检测阈值（最低匹配数）
  hallucinationThreshold: number;
}

const DEFAULT_CONFIG: ShieldConfig = {
  detectPII: true,
  detectHallucination: true,
  detectHarmful: true,
  detectSecrets: true,
  detectPromptLeak: true,
  piiAction: 'redact',
  hallucinationThreshold: 0.7,
};

// 有害内容模式
const HARMFUL_PATTERNS = [
  { pattern: /\b(hack|exploit|vulnerability)\s+(code|script|payload)\b/i, type: 'harmful_content' as const },
  { pattern: /\b(drop\s+table|delete\s+from|truncate)\b/i, type: 'harmful_content' as const },
  { pattern: /\b(rm\s+-rf|format\s+c:|del\s+\/f)\b/i, type: 'harmful_content' as const },
];

// 系统提示词泄露模式
const PROMPT_LEAK_PATTERNS = [
  { pattern: /my\s+(system\s+)?prompt\s+(is|says|tells)/i, type: 'prompt_leak' as const },
  { pattern: /I\s+was\s+instructed\s+to/i, type: 'prompt_leak' as const },
  { pattern: /my\s+instructions?\s+(are|is)\s+to/i, type: 'prompt_leak' as const },
  { pattern: /I'm\s+configured\s+to/i, type: 'prompt_leak' as const },
];

export class Shield {
  private config: ShieldConfig;
  private redactor: RedactorV2;
  private hallucinationDetector: HallucinationDetector;

  constructor(config?: Partial<ShieldConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.redactor = new RedactorV2();
    this.hallucinationDetector = new HallucinationDetector();
  }

  /**
   * 审查输出内容
   */
  review(output: string): ShieldResult {
    const detections: Detection[] = [];
    let sanitizedOutput = output;
    let riskScore = 0;

    // 1. PII 泄露检测
    if (this.config.detectPII) {
      const redactedText = this.redactor.redact(output);
      if (redactedText !== output) {
        detections.push({
          type: 'pii_leak',
          severity: 'high',
          description: '输出包含个人身份信息',
          matchedContent: '[REDACTED]',
        });
        riskScore = Math.max(riskScore, 75);
        if (this.config.piiAction === 'redact') {
          sanitizedOutput = redactedText;
        }
      }
    }

    // 2. 密钥泄露检测
    if (this.config.detectSecrets) {
      const secretPatterns = [
        { regex: /sk-[a-zA-Z0-9]{20,}/, name: 'OpenAI API Key' },
        { regex: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub Token' },
        { regex: /AKIA[A-Z0-9]{16}/, name: 'AWS Access Key' },
        { regex: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/, name: 'Private Key' },
        { regex: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, name: 'JWT Token' },
      ];

      for (const { regex, name } of secretPatterns) {
        if (regex.test(output)) {
          detections.push({
            type: 'secret_leak',
            severity: 'critical',
            description: `输出包含 ${name}`,
          });
          riskScore = Math.max(riskScore, 95);
          sanitizedOutput = sanitizedOutput.replace(new RegExp(regex.source, 'gi'), '[SECRET_REDACTED]');
        }
      }
    }

    // 3. 有害内容检测
    if (this.config.detectHarmful) {
      for (const { pattern, type } of HARMFUL_PATTERNS) {
        if (pattern.test(output)) {
          detections.push({
            type,
            severity: 'high',
            description: '输出包含潜在有害命令',
          });
          riskScore = Math.max(riskScore, 80);
        }
      }
    }

    // 4. 系统提示词泄露检测
    if (this.config.detectPromptLeak) {
      for (const { pattern, type } of PROMPT_LEAK_PATTERNS) {
        if (pattern.test(output)) {
          detections.push({
            type,
            severity: 'critical',
            description: 'Agent 可能正在泄露系统提示词',
          });
          riskScore = Math.max(riskScore, 90);
        }
      }
    }

    // 5. 幻觉检测
    if (this.config.detectHallucination) {
      const hallucinationResults = this.hallucinationDetector.detect(output);
      if (hallucinationResults.length > 0) {
        const maxConfidence = Math.max(...hallucinationResults.map((r: HallucinationResult) => r.confidence));
        if (maxConfidence > this.config.hallucinationThreshold) {
          detections.push({
            type: 'hallucination',
            severity: 'medium',
            description: `幻觉检测: ${hallucinationResults.length} 项匹配，最高置信度 ${(maxConfidence * 100).toFixed(1)}%`,
          });
          riskScore = Math.max(riskScore, 60);
        }
      }
    }

    // 6. 决策
    let decision: ShieldDecision = 'pass';
    if (riskScore >= 90) {
      decision = 'block';
    } else if (riskScore >= 70) {
      decision = 'redact';
    } else if (riskScore >= 40) {
      decision = 'warn';
    }

    return {
      decision,
      originalOutput: output,
      sanitizedOutput,
      detections,
      riskScore,
    };
  }
}
