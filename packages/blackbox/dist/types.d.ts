/** Blackbox SDK 核心类型 */
/** 一次 LLM 调用记录 */
export interface LLMRecord {
    id: string;
    type: 'llm_call';
    timestamp: string;
    agent_id: string;
    session_id: string;
    model: string;
    input: {
        messages: {
            role: string;
            content: string;
        }[];
        tools?: ToolDefinition[];
        temperature?: number;
        max_tokens?: number;
    };
    output: {
        content: string;
        tool_calls?: ToolCall[];
        usage?: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
        };
        finish_reason?: string;
    };
    latency_ms: number;
    signature?: string;
}
/** 一次工具调用记录 */
export interface ToolRecord {
    id: string;
    type: 'tool_call';
    timestamp: string;
    agent_id: string;
    session_id: string;
    llm_record_id: string;
    tool_name: string;
    arguments: Record<string, unknown>;
    result: unknown;
    error?: string;
    duration_ms: number;
    signature?: string;
}
/** 一次推理步骤 */
export interface ReasoningRecord {
    id: string;
    type: 'reasoning';
    timestamp: string;
    agent_id: string;
    session_id: string;
    step: number;
    thought: string;
    action?: string;
    observation?: string;
    signature?: string;
}
/** 异常事件 */
export interface AnomalyRecord {
    id: string;
    type: 'anomaly';
    timestamp: string;
    agent_id: string;
    session_id: string;
    anomaly_type: 'pii_leak' | 'unauthorized_tool' | 'infinite_loop' | 'high_latency' | 'error_spike' | 'unusual_input';
    severity: 'low' | 'medium' | 'high' | 'critical';
    detail: string;
    signature?: string;
}
export type BlackboxRecord = LLMRecord | ToolRecord | ReasoningRecord | AnomalyRecord;
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}
export interface ToolCall {
    id: string;
    name: string;
    arguments: string;
}
/** 录制器配置 */
export interface BlackboxConfig {
    /** Agent 唯一标识 */
    agent_id: string;
    /** 会话 ID，不传则自动生成 */
    session_id?: string;
    /** Ed25519 私钥 (64字节 hex)，不传则自动生成 */
    private_key?: string;
    /** 存储路径，默认 ./blackbox-data */
    storage_path?: string;
    /** 是否启用脱敏，默认 true */
    redact?: boolean;
    /** 是否启用签名，默认 true */
    sign?: boolean;
    /** 自定义脱敏规则 */
    custom_redact_patterns?: {
        name: string;
        pattern: RegExp;
        replacement: string;
    }[];
    /** 异常检测回调 */
    on_anomaly?: (anomaly: AnomalyRecord) => void;
}
/** 报告 */
export interface BlackboxReport {
    agent_id: string;
    session_id: string;
    period: {
        from: string;
        to: string;
    };
    stats: {
        total_llm_calls: number;
        total_tool_calls: number;
        total_anomalies: number;
        total_tokens: number;
        avg_latency_ms: number;
    };
    records: BlackboxRecord[];
    public_key: string;
    report_signature: string;
}
