# 龙虾学院 · 第7轮迭代：Blackbox SDK详细设计

> 迭代时间：2026-03-24 00:22
> 迭代角度：产品技术实现

## SDK架构

```
lobster-blackbox/
├── src/
│   ├── recorder.ts      # 核心录制引擎
│   ├── redactor.ts      # 自动脱敏
│   ├── signer.ts        # Ed25519签名
│   ├── reporter.ts      # 报告生成
│   └── types.ts         # 类型定义
├── plugins/
│   ├── openai.ts        # OpenAI拦截器
│   ├── anthropic.ts     # Claude拦截器
│   ├── langchain.ts     # LangChain集成
│   └── custom.ts        # 自定义Agent适配
├── cli/
│   └── check.ts         # 体检命令
└── package.json
```

## 核心API设计

### 1. 初始化
```typescript
const box = new LobsterBlackbox({
  agentId: 'my-agent-001',
  // 本地模式（不上传）
  mode: 'local',
  // 或云端模式
  // mode: 'cloud',
  // apiKey: 'lobster_xxx',
  
  // 脱敏规则
  redact: {
    patterns: ['email', 'phone', 'creditCard', 'ssn', 'idCard'],
    custom: [/internal-api\.company\.com/g],
  },
  
  // 签名密钥（本地生成）
  signingKey: process.env.LOBSTER_SIGNING_KEY,
});
```

### 2. 录制决策
```typescript
// 方式1: 手动录制
const record = await box.record({
  type: 'decision',
  input: { userMessage: '帮我发邮件给张三' },
  reasoning: '用户请求发送邮件，收件人在通讯录中',
  output: { action: 'send_email', to: '[REDACTED]' },
  toolCalls: [
    { tool: 'email_api', params: {...}, result: 'sent' }
  ],
  duration: 1200, // ms
});

// 方式2: 自动拦截（OpenAI）
box.instrument(openai);

// 之后所有OpenAI调用自动录制
const completion = await openai.chat.completions.create({...});
// → 自动录制到Blackbox
```

### 3. 生成报告
```typescript
// 生成PDF报告
const report = await box.generateReport({
  period: { from: '2026-03-01', to: '2026-03-31' },
  format: 'pdf',
  include: ['decisions', 'toolCalls', 'errors', 'statistics'],
});

// 生成可验证签名
const signed = await box.signReport(report);
// signed.proof 包含Ed25519签名，可独立验证

// 验证报告
const valid = LobsterBlackbox.verifyReport(signed);
```

### 4. 体检命令
```bash
# 检查本地Agent配置
lobster check ./agent.yaml

# 检查OpenClaw agent
lobster check --openclaw ./agents/my-agent/

# 生成体检报告
lobster check ./agent.yaml --output report.pdf
```

## 数据模型

### DecisionRecord
```json
{
  "id": "uuid",
  "agentId": "my-agent-001",
  "timestamp": "2026-03-24T00:22:00Z",
  "type": "decision",
  "input": { "..." },
  "reasoning": "Agent的推理过程",
  "output": { "..." },
  "toolCalls": [...],
  "duration": 1200,
  "signature": "ed25519:base64...",
  "hash": "sha256:..."
}
```

### AuditReport
```json
{
  "id": "uuid",
  "agentId": "my-agent-001",
  "period": { "from": "...", "to": "..." },
  "summary": {
    "totalDecisions": 1523,
    "toolCalls": 892,
    "errors": 12,
    "avgDuration": 890,
    "uniqueTools": 15
  },
  "anomalies": [...],
  "records": [...],
  "signature": "ed25519:base64...",
  "generatedAt": "2026-03-24T00:22:00Z"
}
```

## 隐私设计

| 数据 | 处理方式 |
|------|---------|
| 用户输入 | 脱敏后存储（PII替换为[REDACTED]） |
| Agent推理 | 完整存储（核心价值） |
| 工具参数 | 脱敏敏感字段 |
| 工具结果 | 摘要存储（不存原始数据） |
| API密钥 | 永不录制 |
| 签名密钥 | 用户本地持有，不上传 |

## 开发排期

| 周 | 任务 | 产出 |
|------|------|------|
| W1 | 核心录制引擎+脱敏 | 能录制Agent决策 |
| W2 | 签名+报告生成 | 能生成签名报告 |
| W3 | OpenAI/LangChain插件 | 自动拦截主流框架 |
| W4 | CLI体检+文档+发布 | npm publish |

---
