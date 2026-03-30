import { BlackboxConfig, LLMRecord, ToolRecord, BlackboxReport } from './types';
export declare class Blackbox {
    private config;
    private redactor;
    private signer;
    private store;
    private detector;
    private sessionId;
    private records;
    private currentLLMId;
    constructor(config: BlackboxConfig);
    /** 录制一次 LLM 调用（调用前） */
    startLLMCall(input: {
        model: string;
        messages: {
            role: string;
            content: string;
        }[];
        tools?: LLMRecord['input']['tools'];
        temperature?: number;
        max_tokens?: number;
    }): string;
    /** 录制一次 LLM 调用（调用后） */
    recordLLM(input: {
        model: string;
        messages: {
            role: string;
            content: string;
        }[];
        tools?: LLMRecord['input']['tools'];
        temperature?: number;
        max_tokens?: number;
    }, output: LLMRecord['output'], latencyMs: number): LLMRecord;
    /** 录制一次工具调用 */
    recordTool(input: {
        tool_name: string;
        arguments: Record<string, unknown>;
        result?: unknown;
        error?: string;
        duration_ms: number;
    }): ToolRecord;
    /** 生成报告 */
    generateReport(from?: string, to?: string): BlackboxReport;
    /** 获取公钥 */
    getPublicKey(): string;
    /** 获取会话 ID */
    getSessionId(): string;
    private generateId;
}
export declare function wrapOpenAI(blackbox: Blackbox, client: {
    chat: {
        completions: {
            create: (...args: unknown[]) => Promise<unknown>;
        };
    };
}): typeof client;
export { Redactor } from './redactor';
export { Signer } from './signer';
export { Store } from './store';
export { AnomalyDetector } from './anomaly';
export type * from './types';
