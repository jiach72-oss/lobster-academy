/** 异常检测引擎 */
import { AnomalyRecord, LLMRecord, ToolRecord } from './types';
export declare class AnomalyDetector {
    private agentId;
    private sessionId;
    private recentLatencies;
    private recentErrors;
    private recentCalls;
    private toolCallCounts;
    private onAnomaly?;
    private windowStart;
    constructor(agentId: string, sessionId: string, onAnomaly?: (a: AnomalyRecord) => void);
    /** 分析一条 LLM 记录 */
    analyzeLLM(record: LLMRecord): void;
    /** 分析一条工具调用记录 */
    analyzeTool(record: ToolRecord): void;
    /** 定期窗口检查 */
    checkWindow(): void;
    private emit;
}
