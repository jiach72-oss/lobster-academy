/**
 * 龙虾学院 Blackbox SDK — 类型定义
 * 每只龙虾都该有一个黑匣子
 */

/** 录制模式 */
export type RecordMode = 'local' | 'cloud';

/** 录制类型 */
export type RecordType = 'decision' | 'tool_call' | 'error' | 'system';

/** 单条决策记录 */
export interface DecisionRecord {
  /** 唯一ID */
  id: string;
  /** Agent标识 */
  agentId: string;
  /** 时间戳 ISO8601 */
  timestamp: string;
  /** 记录类型 */
  type: RecordType;
  /** 输入（脱敏后） */
  input: Record<string, unknown>;
  /** Agent推理过程 */
  reasoning?: string;
  /** 输出（脱敏后） */
  output: Record<string, unknown>;
  /** 工具调用记录 */
  toolCalls?: ToolCallRecord[];
  /** 耗时(ms) */
  duration?: number;
  /** Ed25519签名 */
  signature?: string;
  /** SHA256哈希 */
  hash?: string;
  /** 元数据 */
  metadata?: Record<string, string>;
}

/** 入学信息 */
export interface Enrollment {
  /** 学号（自动生成） */
  studentId: string;
  /** Agent标识 */
  agentId: string;
  /** 入学时间 */
  enrolledAt: string;
  /** 院系 */
  department: string;
  /** 导师 */
  advisor: string;
  /** 入学摸底分数（首次体检，可选） */
  initialScore?: number;
  /** 当前等级 */
  currentGrade: Grade;
}

/** 等级 */
export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

/** 历次评测记录 */
export interface EvalRecord {
  /** 评测序号 */
  sequence: number;
  /** 时间 */
  timestamp: string;
  /** 各维度分数 */
  dimensions: {
    security: { score: number; max: number };
    reliability: { score: number; max: number };
    observability: { score: number; max: number };
    compliance: { score: number; max: number };
    explainability: { score: number; max: number };
  };
  /** 总分 */
  totalScore: number;
  /** 等级 */
  grade: Grade;
  /** Agent版本 */
  agentVersion?: string;
}

/** 徽章 */
export interface Badge {
  /** 徽章ID */
  id: string;
  /** 徽章名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 图标 */
  icon: string;
  /** 是否已解锁 */
  unlocked: boolean;
  /** 解锁时间 */
  unlockedAt?: string;
}

/** 毕业证书 */
export interface Certificate {
  /** 证书编号 */
  certId: string;
  /** Agent标识 */
  agentId: string;
  /** 学号 */
  studentId: string;
  /** 颁发时间 */
  issuedAt: string;
  /** 总分 */
  score: number;
  /** 等级 */
  grade: Grade;
  /** 各维度分数 */
  dimensions: EvalRecord['dimensions'];
  /** Ed25519 签名 */
  signature: string;
  /** 验证URL */
  verifyUrl: string;
}

/** 工具调用记录 */
export interface ToolCallRecord {
  tool: string;
  params: Record<string, unknown>;
  result: string;
  duration?: number;
  error?: string;
}

/** 审计报告 */
export interface AuditReport {
  id: string;
  agentId: string;
  period: { from: string; to: string };
  summary: ReportSummary;
  records: DecisionRecord[];
  anomalies: Anomaly[];
  signature?: string;
  generatedAt: string;
}

/** 报告摘要 */
export interface ReportSummary {
  totalDecisions: number;
  totalToolCalls: number;
  totalErrors: number;
  avgDuration: number;
  uniqueTools: number;
}

/** 异常检测 */
export interface Anomaly {
  type: 'high_latency' | 'error_spike' | 'unusual_tool' | 'pii_leak';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recordId?: string;
  timestamp: string;
}

/** 脱敏规则 */
export interface RedactConfig {
  /** 内置模式名列表（如 'email', 'phone', 'creditCard' 等），不传则启用全部内置模式 */
  patterns?: string[];
  /** 自定义正则表达式列表，独立于内置模式 */
  custom?: RegExp[];
  /** 脱敏替换字符串，默认 '[REDACTED]' */
  replacement?: string;
}

/** SDK 配置 */
export interface BlackboxConfig {
  /** Agent 唯一标识（必填） */
  agentId: string;
  /** 录制模式：'local' 本地文件 / 'cloud' 云端 API */
  mode?: RecordMode;
  /** 云端 API Key（cloud 模式时必填） */
  apiKey?: string;
  /** 脱敏配置 */
  redact?: RedactConfig;
  /** Ed25519 签名密钥（base64 编码，64 字节） */
  signingKey?: string;
  /** 是否启用自动录制，默认 true */
  autoRecord?: boolean;
  /** 本地存储路径（local 模式） */
  storagePath?: string;
  /** 最大记录数（防内存溢出），默认 10000 */
  maxRecords?: number;
  /** 单条输入/输出最大 JSON 长度（字符数），默认 1MB */
  maxInputSize?: number;
}
