/**
 * 龙虾学院 Blackbox SDK — 错误码
 * 所有 SDK 异常的统一错误码定义
 */

/** SDK 错误码枚举 */
export enum BlackboxErrorCode {
  // ─── 配置错误 (1xxx) ───
  /** agentId 缺失或为空 */
  MISSING_AGENT_ID = 'BLACKBOX_1001',
  /** signingKey 长度不正确 */
  INVALID_SIGNING_KEY = 'BLACKBOX_1002',
  /** 配置缺少必填字段 */
  INVALID_CONFIG = 'BLACKBOX_1003',
  /** apiKey 缺失但 mode 为 cloud */
  MISSING_API_KEY = 'BLACKBOX_1004',

  // ─── 录制错误 (2xxx) ───
  /** 超出最大记录数限制 */
  MAX_RECORDS_EXCEEDED = 'BLACKBOX_2001',
  /** 输入/输出大小超出限制 */
  INPUT_TOO_LARGE = 'BLACKBOX_2002',
  /** record() 数据格式无效 */
  INVALID_RECORD_DATA = 'BLACKBOX_2003',
  /** record type 无效 */
  INVALID_RECORD_TYPE = 'BLACKBOX_2004',
  /** duration 值无效 */
  INVALID_DURATION = 'BLACKBOX_2005',

  // ─── 签名错误 (3xxx) ───
  /** 签名密钥未配置 */
  NO_SIGNING_KEY = 'BLACKBOX_3001',
  /** 签名验证失败 */
  SIGNATURE_INVALID = 'BLACKBOX_3002',
  /** 签名数据类型错误 */
  INVALID_SIGN_DATA = 'BLACKBOX_3003',

  // ─── 脱敏错误 (4xxx) ───
  /** 脱敏超时 */
  REDACT_TIMEOUT = 'BLACKBOX_4001',
  /** 脱敏深度超限 */
  REDACT_DEPTH_EXCEEDED = 'BLACKBOX_4002',

  // ─── 存储错误 (5xxx) ───
  /** 存储未初始化 */
  STORAGE_NOT_INITIALIZED = 'BLACKBOX_5001',
  /** 存储连接失败 */
  STORAGE_CONNECTION_FAILED = 'BLACKBOX_5002',
  /** 数据库查询失败 */
  STORAGE_QUERY_FAILED = 'BLACKBOX_5003',

  // ─── 报告错误 (6xxx) ───
  /** 报告生成失败 */
  REPORT_GENERATION_FAILED = 'BLACKBOX_6001',
  /** 报告数据无效 */
  INVALID_REPORT_DATA = 'BLACKBOX_6002',

  // ─── 通用错误 (9xxx) ───
  /** 未知错误 */
  UNKNOWN = 'BLACKBOX_9999',
}

/** SDK 自定义错误类 */
export class BlackboxError extends Error {
  /** 错误码 */
  public readonly code: BlackboxErrorCode;
  /** 原始错误（如果有的话） */
  public readonly cause?: Error;

  constructor(code: BlackboxErrorCode, message: string, cause?: Error) {
    super(message);
    this.name = 'BlackboxError';
    this.code = code;
    this.cause = cause;
    // 恢复原型链（TypeScript class extends Error 的标准做法）
    Object.setPrototypeOf(this, BlackboxError.prototype);
  }

  /** 转换为 JSON 对象 */
  toJSON(): { name: string; code: string; message: string; cause?: string } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.cause && { cause: this.cause.message }),
    };
  }
}
