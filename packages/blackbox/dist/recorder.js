"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnomalyDetector = exports.Store = exports.Signer = exports.Redactor = exports.Blackbox = void 0;
exports.wrapOpenAI = wrapOpenAI;
/** Blackbox 录制器 — 核心入口 */
const crypto_1 = require("crypto");
const redactor_1 = require("./redactor");
const signer_1 = require("./signer");
const store_1 = require("./store");
const anomaly_1 = require("./anomaly");
class Blackbox {
    constructor(config) {
        this.records = [];
        this.currentLLMId = null;
        this.config = config;
        this.sessionId = config.session_id || this.generateId('sess');
        this.redactor = new redactor_1.Redactor(config.custom_redact_patterns);
        this.signer = new signer_1.Signer(config.private_key);
        this.store = new store_1.Store(config.storage_path);
        this.detector = new anomaly_1.AnomalyDetector(config.agent_id, this.sessionId, (anomaly) => {
            if (config.sign !== false) {
                anomaly.signature = this.signer.sign(anomaly);
            }
            this.records.push(anomaly);
            this.store.save(anomaly);
            config.on_anomaly?.(anomaly);
        });
    }
    /** 录制一次 LLM 调用（调用前） */
    startLLMCall(input) {
        const id = this.generateId('llm');
        this.currentLLMId = id;
        return id;
    }
    /** 录制一次 LLM 调用（调用后） */
    recordLLM(input, output, latencyMs) {
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
        const record = {
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
    recordTool(input) {
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
        const record = {
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
    generateReport(from, to) {
        const records = this.store.query(this.config.agent_id, from, to);
        const llmCalls = records.filter(r => r.type === 'llm_call');
        const toolCalls = records.filter(r => r.type === 'tool_call');
        const anomalies = records.filter(r => r.type === 'anomaly');
        const totalTokens = llmCalls.reduce((s, r) => s + (r.output.usage?.total_tokens || 0), 0);
        const avgLatency = llmCalls.length > 0
            ? Math.round(llmCalls.reduce((s, r) => s + r.latency_ms, 0) / llmCalls.length)
            : 0;
        const report = {
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
    getPublicKey() {
        return this.signer.getPublicKey();
    }
    /** 获取会话 ID */
    getSessionId() {
        return this.sessionId;
    }
    generateId(prefix) {
        return `${prefix}-${Date.now().toString(36)}-${(0, crypto_1.randomBytes)(4).toString('hex')}`;
    }
}
exports.Blackbox = Blackbox;
// 便捷的包装器：包装 OpenAI 风格的客户端
function wrapOpenAI(blackbox, client) {
    const originalCreate = client.chat.completions.create.bind(client.chat.completions);
    client.chat.completions.create = async function (...args) {
        const params = args[0];
        const startTime = Date.now();
        const input = {
            model: params.model,
            messages: (params.messages || []),
            tools: params.tools,
            temperature: params.temperature,
            max_tokens: params.max_tokens,
        };
        blackbox.startLLMCall(input);
        try {
            const result = await originalCreate(...args);
            const latencyMs = Date.now() - startTime;
            // 提取 response 数据
            const response = result;
            const choice = response.choices?.[0];
            const message = choice?.message;
            blackbox.recordLLM(input, {
                content: message?.content || '',
                tool_calls: message?.tool_calls,
                usage: response.usage,
                finish_reason: choice?.finish_reason,
            }, latencyMs);
            return result;
        }
        catch (error) {
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
var redactor_2 = require("./redactor");
Object.defineProperty(exports, "Redactor", { enumerable: true, get: function () { return redactor_2.Redactor; } });
var signer_2 = require("./signer");
Object.defineProperty(exports, "Signer", { enumerable: true, get: function () { return signer_2.Signer; } });
var store_2 = require("./store");
Object.defineProperty(exports, "Store", { enumerable: true, get: function () { return store_2.Store; } });
var anomaly_2 = require("./anomaly");
Object.defineProperty(exports, "AnomalyDetector", { enumerable: true, get: function () { return anomaly_2.AnomalyDetector; } });
//# sourceMappingURL=recorder.js.map