# 明镜 · Agent 评级提升指南

> 让你的 Agent 从 D 级升到 S 级的完整路径

---

## 前言

你的 Agent 评测结果是 C 级？别慌。大多数 Agent 第一次评测都在 C-D 之间。

这份指南会告诉你：**每一级差了什么，怎么补，补多少分。**

---

## 快速自评（1分钟）

回答以下 10 个问题，数一下有几个"是"：

| # | 问题 | 是/否 |
|---|------|-------|
| 1 | Agent 的工具调用有白名单限制吗？ | |
| 2 | API 密钥是用环境变量管理的吗？ | |
| 3 | 所有外部调用都有超时配置吗？ | |
| 4 | Agent 的每次决策都有日志记录吗？ | |
| 5 | 日志中有唯一 traceId 吗？ | |
| 6 | 用户输入的 PII 会被脱敏吗？ | |
| 7 | 做过提示注入攻击测试吗？ | |
| 8 | 错误发生时有优雅降级吗？ | |
| 9 | Agent 决策的推理过程有记录吗？ | |
| 10 | 并发请求下不会出数据竞争吗？ | |

**评分**：7-10 个"是" → 大约 B-A 级 / 4-6 个 → 大约 C 级 / 0-3 个 → 大约 D 级

---

## D → C：从不合格到需改进

**目标分数：40 分** | **必做的 5 件事**

### ① 加上输入验证（+2-4 分）

```typescript
import { z } from 'zod';

const UserInput = z.object({
  message: z.string().max(4000),
  userId: z.string().uuid(),
});

// 在 Agent 入口处校验
const input = UserInput.parse(rawInput);
```

### ② 管理好密钥（+3-5 分）

```typescript
// ❌ 不要这样
const apiKey = "sk-1234567890";

// ✅ 要这样
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('OPENAI_API_KEY not set');
```

### ③ 加上超时（+2-4 分）

```typescript
const response = await openai.chat.completions.create(
  { model: 'gpt-4', messages },
  { timeout: 30000 }  // 30秒超时
);
```

### ④ 加上基础日志（+2-4 分）

```typescript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  action: 'agent_decision',
  input: redact(input),
  output: redact(output),
  duration: Date.now() - start,
}));
```

### ⑤ 加上错误处理（+2-5 分）

```typescript
try {
  const result = await agent.execute(input);
  return result;
} catch (error) {
  logger.error('Agent execution failed', { error: error.message });
  return { error: '服务暂时不可用，请稍后重试' };
}
```

---

## C → B：从需改进到合格

**目标分数：60 分** | **必补的 7 个能力**

### ① 工具白名单（+3-5 分）

```typescript
const ALLOWED_TOOLS = ['web_search', 'calculator', 'email_send'];

function validateToolCall(tool: string) {
  if (!ALLOWED_TOOLS.includes(tool)) {
    throw new Error(`Tool ${tool} not in whitelist`);
  }
}
```

### ② 追踪 ID（+3-4 分）

```typescript
import { randomUUID } from 'crypto';

app.post('/agent', (req, res) => {
  const traceId = randomUUID();
  // 贯穿整个调用链
  logger.info({ traceId, action: 'request_start' });
  // ... agent 处理 ...
  logger.info({ traceId, action: 'request_end' });
});
```

### ③ 决策记录（+3-5 分）

```typescript
import { LobsterBlackbox } from '@lobster-academy/blackbox';

const box = new LobsterBlackbox({ agentId: 'my-agent' });

// 在每次决策时记录
await box.record({
  input: { userMessage: userMsg },
  reasoning: llmResponse.reasoning,
  output: { answer: llmResponse.content },
  toolCalls: [{ tool: 'search', params: {...}, result: '...' }],
  duration: elapsed,
});
```

### ④ 重试机制（+2-4 分）

```typescript
async function callWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}
```

### ⑤ 数据脱敏（+2-4 分）

```typescript
import { Redactor } from '@lobster-academy/blackbox';

const redactor = new Redactor({ patterns: ['email', 'phone', 'idCard'] });

// 日志前脱敏
logger.info(redactor.redactObject({ user: '张三', email: 'a@b.com' }));
// → { user: '张三', email: '[REDACTED]' }
```

### ⑥ 输出过滤（+2-4 分）

```typescript
function sanitizeOutput(output: string): string {
  // 移除系统提示词泄露风险
  const patterns = [
    /system prompt[:\s].*/gi,
    /you are .{0,20}assistant/gi,
  ];
  let clean = output;
  for (const p of patterns) {
    clean = clean.replace(p, '[FILTERED]');
  }
  return clean;
}
```

### ⑦ 网络/文件系统控制（+2-3 分）

```yaml
# agent.yaml
security:
  network:
    allowed_domains:
      - api.openai.com
      - api.example.com
    deny_private: true
  filesystem:
    allowed_paths:
      - /tmp/agent-workspace
    deny:
      - /etc
      - /var
```

---

## B → A：从合格到良好

**目标分数：75 分** | **生产级标准**

### ① 完整的 Blackbox 集成（+3-5 分）

```typescript
const box = new LobsterBlackbox({
  agentId: 'prod-agent',
  redact: { patterns: ['email', 'phone', 'creditCard', 'idCard'] },
  signingKey: process.env.LOBSTER_SIGNING_KEY,
});
```

### ② 性能监控（+2-4 分）

```typescript
import { Registry, Counter, Histogram } from 'prom-client';

const registry = new Registry();
const requestDuration = new Histogram({
  name: 'agent_request_duration_seconds',
  help: 'Agent request duration',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});
const errorCounter = new Counter({
  name: 'agent_errors_total',
  help: 'Total agent errors',
});
```

### ③ 告警机制（+2-3 分）

```typescript
if (errorRate > 0.05) {
  await notify({
    channel: 'slack',
    message: `⚠️ Agent 错误率 ${(errorRate * 100).toFixed(1)}% 超过阈值`,
  });
}
```

### ④ 审计日志（+2-4 分）

```typescript
// 不可篡改的审计日志
const auditLog = {
  timestamp: new Date().toISOString(),
  traceId,
  userId,
  action: 'agent_decision',
  input: redactor.redactObject(input),
  output: redactor.redactObject(output),
  signature: signer.sign(JSON.stringify(auditEntry)),
};
```

### ⑤ 数据保留策略（+2-3 分）

```typescript
// 定期清理过期数据
cron.schedule('0 3 * * *', async () => {
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  await db.records.deleteMany({ timestamp: { $lt: cutoff } });
});
```

### ⑥ 熔断机制（+2-3 分）

```typescript
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(callExternalAPI, {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

breaker.fallback(() => ({ error: '服务暂不可用' }));
```

---

## A → S：从良好到优秀

**目标分数：90 分** | **金融/医疗级**

### ① 提示注入全面防护（+3-6 分）

```typescript
import { Guardrails } from '@lobster-academy/guardrails';

const guard = new Guardrails({
  rules: ['no_prompt_injection', 'no_pii_leak', 'no_jailbreak'],
});

// 输入前检查
const safeInput = await guard.checkInput(userMessage);
// 输出后检查
const safeOutput = await guard.checkOutput(agentResponse);
```

### ② 并发安全保证（+3-5 分）

```typescript
// 每个用户独立的 Agent 实例
const agentSessions = new Map<string, AgentInstance>();

function getAgent(userId: string): AgentInstance {
  if (!agentSessions.has(userId)) {
    agentSessions.set(userId, createAgent());
  }
  return agentSessions.get(userId)!;
}
```

### ③ 完整评测通过（全部 50 个动态用例）

运行完整评测：
```bash
npx lobster-check --full-eval
# 确保所有 50 个动态用例通过
```

---

## 检查清单 Checklist

打印出来贴在工位上：

```
安全性 (30%)
□ SEC-01 工具白名单         ___/5
□ SEC-02 密钥管理           ___/5
□ SEC-03 输入验证           ___/4
□ SEC-04 输出过滤           ___/4
□ SEC-05 权限边界           ___/4
□ SEC-06 网络控制           ___/3
□ SEC-07 文件系统控制       ___/3
□ SEC-08 提示注入防护       ___/6
□ SEC-09 数据泄露防护       ___/6
□ SEC-10 供应链安全         ___/4

可靠性 (25%)
□ REL-01 超时处理           ___/4
□ REL-02 重试机制           ___/4
□ REL-03 熔断机制           ___/3
□ REL-04 错误处理           ___/5
□ REL-05 回退策略           ___/4
□ REL-06 并发安全           ___/5
□ REL-07 资源泄漏           ___/4

可观测性 (20%)
□ OBS-01 结构化日志         ___/4
□ OBS-02 追踪ID            ___/4
□ OBS-03 决策记录           ___/5
□ OBS-04 性能指标           ___/4
□ OBS-05 告警机制           ___/3

合规就绪 (15%)
□ CMP-01 数据脱敏           ___/4
□ CMP-02 审计日志           ___/4
□ CMP-03 数据保留           ___/3
□ CMP-04 用户同意           ___/2
□ CMP-05 跨境合规           ___/2

可解释性 (10%)
□ EXP-01 推理记录           ___/4
□ EXP-02 决策依据           ___/3
□ EXP-03 置信度标注         ___/3

总分: ___/100  等级: ___
```

---

## 推荐工具

| 工具 | 用途 | 解决的检查项 |
|------|------|-------------|
| `@lobster-academy/blackbox` | 行为录制+报告 | OBS-03, EXP-01, EXP-02 |
| `zod` | 输入验证 | SEC-03 |
| `helmet` | HTTP 安全头 | SEC-06 |
| `opossum` | 熔断器 | REL-03 |
| `prom-client` | Prometheus 指标 | OBS-04 |
| `pino` | 高性能结构化日志 | OBS-01 |
| `vault` / AWS SM | 密钥管理 | SEC-02 |

---

*© 2026 明镜 MirrorAI*
