/** Blackbox 录制器 — 核心入口 */
import { randomBytes } from 'crypto';
import { BlackboxConfig, BlackboxRecord, LLMRecord, ToolRecord, BlackboxReport } from './types';
import { Redactor } from './redactor';
import { Signer } from './signer';
import { Store } from './store';
import { AnomalyDetector } from './anomaly';

export class Blackbox {
  private config: BlackboxConfig;
  private redactor: Redactor;
  private signer: Signer;
  private store: Store;
  private detector: AnomalyDetector;
  private sessionId: string;
  private records: BlackboxRecord[] = [];
  private currentLLMId: string | null = null;

  constructor(config: BlackboxConfig) {
    this.config = config;
    this.sessionId = config.session_id || this.generateId('sess');
    this.redactor = new Redactor(config.custom_redact_patterns);
    this.signer = new Signer(config.private_key);
    this.store = new Store(config.storage_path);
    this.detector = new AnomalyDetector(
      config.agent_id,
      this.sessionId,
      (anomaly) => {
        if (config.sign !== false) {
          anomaly.signature = this.signer.sign(anomaly);
        }
        this.records.push(anomaly);
        this.store.save(anomaly);
        config.on_anomaly?.(anomaly);
      }
    );
  }

  /** 录制一次 LLM 调用（调用前） */
  startLLMCall(input: {
    model: string;
    messages: { role: string; content: string }[];
    tools?: LLMRecord['input']['tools'];
    temperature?: number;
    max_tokens?: number;
  }): string {
    const id = this.generateId('llm');
    this.currentLLMId = id;
    return id;
  }

  /** 录制一次 LLM 调用（调用后） */
  recordLLM(input: {
    model: string;
    messages: { role: string; content: string }[];
    tools?: LLMRecord['input']['tools'];
    temperature?: number;
    max_tokens?: number;
  }, output: LLMRecord['output'], latencyMs: number): LLMRecord {
    const id = this.currentLLMId || this.generateId('llm');
    this.currentLLMId = null;

    // 脱敏
    const shouldRedact = this.config.redact !== false;
    let safeInput = input;
    let safeOutput = output;
    if (shouldRedact) {
      safeInput = this.redactor.redactObject(input).result;
      safeOutput = this.redactor.redactObject(output).result;
    }

    const record: LLMRecord = {
      id,
      type: 'llm_call',
      timestamp: new Date().toISOString(),
      agent_id: this.config.agent_id,
      session_id: this.sessionId,
      model: input.model,
      input: safeInput,
      output: safeOutput,
      latency_ms: latencyMs,
    };

    // 签名
    if (this.config.sign !== false) {
      record.signature = this.signer.sign(record);
    }

    // 异常检测
    this.detector.analyzeLLM(record);
    this.detector.checkWindow();

    // 存储
    this.records.push(record);
    this.store.save(record);

    return record;
  }

  /** 录制一次工具调用 */
  recordTool(input: {
    tool_name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    error?: string;
    duration_ms: number;
  }): ToolRecord {
    const id = this.generateId('tool');
    this.currentLLMId && (this.currentLLMId);

    // 脱敏
    const shouldRedact = this.config.redact !== false;
    let safeArgs = input.arguments;
    let safeResult = input.result;
    if (shouldRedact) {
      safeArgs = this.redactor.redactObject(input.arguments).result;
      safeResult = this.redactor.redactObject(input.result).result;
    }

    const record: ToolRecord = {
      id,
      type: 'tool_call',
      timestamp: new Date().toISOString(),
      agent_id: this.config.agent_id,
      session_id: this.sessionId,
      llm_record_id: this.currentLLMId || '',
      tool_name: input.tool_name,
      arguments: safeArgs,
      result: safeResult,
      error: input.error,
      duration_ms: input.duration_ms,
    };

    if (this.config.sign !== false) {
      record.signature = this.signer.sign(record);
    }

    this.detector.analyzeTool(record);

    this.records.push(record);
    this.store.save(record);

    return record;
  }

  /** 生成报告 */
  generateReport(from?: string, to?: string): BlackboxReport {
    const records = this.store.query(this.config.agent_id, from, to);

    const llmCalls = records.filter(r => r.type === 'llm_call') as LLMRecord[];
    const toolCalls = records.filter(r => r.type === 'tool_call') as ToolRecord[];
    const anomalies = records.filter(r => r.type === 'anomaly');

    const totalTokens = llmCalls.reduce((s, r) => s + (r.output.usage?.total_tokens || 0), 0);
    const avgLatency = llmCalls.length > 0
      ? Math.round(llmCalls.reduce((s, r) => s + r.latency_ms, 0) / llmCalls.length)
      : 0;

    const report: BlackboxReport = {
      agent_id: this.config.agent_id,
      session_id: this.sessionId,
      period: {
        from: from || (records[0]?.timestamp || new Date().toISOString()),
        to: to || new Date().toISOString(),
      },
      stats: {
        total_llm_calls: llmCalls.length,
        total_tool_calls: toolCalls.length,
        total_anomalies: anomalies.length,
        total_tokens: totalTokens,
        avg_latency_ms: avgLatency,
      },
      records,
      public_key: this.signer.getPublicKey(),
      report_signature: '',
    };

    // 对整个报告签名
    const { report_signature: _, ...reportBody } = report;
    report.report_signature = this.signer.sign(reportBody);

    return report;
  }

  /** 获取公钥 */
  getPublicKey(): string {
    return this.signer.getPublicKey();
  }

  /** 获取会话 ID */
  getSessionId(): string {
    return this.sessionId;
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
  }
}

// 便捷的包装器：包装 OpenAI 风格的客户端
export function wrapOpenAI(blackbox: Blackbox, client: {
  chat: { completions: { create: (...args: unknown[]) => Promise<unknown> } }
}): typeof client {
  const originalCreate = client.chat.completions.create.bind(client.chat.completions);

  client.chat.completions.create = async function(...args: unknown[]) {
    const params = args[0] as Record<string, unknown>;
    const startTime = Date.now();

    const input = {
      model: params.model as string,
      messages: (params.messages || []) as { role: string; content: string }[],
      tools: params.tools as LLMRecord['input']['tools'],
      temperature: params.temperature as number,
      max_tokens: params.max_tokens as number,
    };

    blackbox.startLLMCall(input);

    try {
      const result = await originalCreate(...args);
      const latencyMs = Date.now() - startTime;

      // 提取 response 数据
      const response = result as Record<string, unknown>;
      const choice = (response.choices as Record<string, unknown>[])?.[0];
      const message = choice?.message as Record<string, unknown> | undefined;

      blackbox.recordLLM(input, {
        content: (message?.content as string) || '',
        tool_calls: message?.tool_calls as LLMRecord['output']['tool_calls'],
        usage: response.usage as LLMRecord['output']['usage'],
        finish_reason: choice?.finish_reason as string,
      }, latencyMs);

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      blackbox.recordLLM(input, {
        content: '',
        finish_reason: 'error',
      }, latencyMs);
      throw error;
    }
  };

  return client;
}

export { Redactor } from './redactor';
export { Signer } from './signer';
export { Store } from './store';
export { AnomalyDetector } from './anomaly';
export type * from './types';
