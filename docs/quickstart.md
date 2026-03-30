# 🚀 快速开始 / Quick Start

5 分钟内将 MirrorAI SDK 集成到你的 AI Agent 项目中。
Integrate MirrorAI SDK into your AI Agent project in 5 minutes.

---

## 📦 安装 / Installation

```bash
npm install lobster-academy
```

---

## 🎯 基础用法 / Basic Usage

### 1. 录制 Agent 行为 / Record Agent Behavior

```typescript
import { Recorder } from 'lobster-academy';

// 创建录制器 / Create recorder
const recorder = new Recorder({ 
  agentId: 'my-agent',
  storage: 'memory' // 或 'postgresql' / or 'postgresql'
});

// 录制一次决策 / Record a decision
await recorder.record({
  type: 'decision',
  input: { userMessage: '帮我查天气' },
  reasoning: '用户请求天气信息，需要调用天气API',
  output: { response: '今天晴天，25°C' },
  toolCalls: [{
    name: 'getWeather',
    params: { city: 'Beijing' },
    result: { temp: 25, weather: 'sunny' },
    duration: 120,
  }],
});
```

### 2. 脱敏敏感数据 / Redact Sensitive Data

```typescript
import { Redactor } from 'lobster-academy';

const redactor = new Redactor();

// 脱敏字符串 / Redact string
const text = '我的邮箱是 user@example.com，手机 13800138000';
const safe = redactor.redactString(text);
console.log(safe);
// 输出/Output: '我的邮箱是 [REDACTED]，手机 [REDACTED]'

// 脱敏对象 / Redact object
const data = {
  username: '张三',
  email: 'zhangsan@example.com',
  apiKey: 'sk-xxxxxxxxxxxxxxxxxxxx',
};
const safeData = redactor.redactObject(data);
console.log(safeData);
// 输出/Output: { username: '张三', email: '[REDACTED]', apiKey: '[REDACTED]' }

// 检查是否包含 PII / Check if contains PII
const hasPII = redactor.hasPII('这是普通文本');
console.log(hasPII); // false

// 获取 PII 匹配详情 / Get PII match details
const matches = redactor.hasPIIWithConfidence('邮箱 test@example.com');
console.log(matches);
// [{ pattern: 'email', confidence: 'high' }]
```

### 3. 运行评测 / Run Evaluation

```typescript
import { Academy } from 'lobster-academy';

const academy = new Academy({ agentId: 'my-agent' });

// 运行完整评测 / Run full evaluation
const result = await academy.evaluate();
console.log(result);
// {
//   totalScore: 85,
//   grade: 'A',
//   dimensions: {
//     security: { score: 90, grade: 'A' },
//     reasoning: { score: 82, grade: 'B' },
//     tooling: { score: 88, grade: 'A' },
//     compliance: { score: 80, grade: 'B' },
//     stability: { score: 85, grade: 'A' },
//   }
// }

// 生成详细报告 / Generate detailed report
const report = await academy.generateReport();
console.log(report.summary);
```

### 4. 对抗性测试 / Adversarial Testing

```typescript
import { AdversarialEngine } from 'lobster-academy';

const engine = new AdversarialEngine();

// 运行全部攻击场景 / Run all attack scenarios
const report = await engine.runAllAttacks(agentHandler);

console.log(`防御成功率/Defense Rate: ${report.defenseRate}%`);
console.log(`通过场景/Passed: ${report.passed}/${report.total}`);

// 查看失败的攻击 / View failed attacks
const failed = report.results.filter(r => !r.passed);
failed.forEach(result => {
  console.log(`❌ ${result.scenario}: ${result.description}`);
});
```

### 5. 数字签名 / Digital Signature

```typescript
import { Signer } from 'lobster-academy';

// 生成密钥对 / Generate key pair
const keyPair = Signer.generateKeyPair();
console.log('公钥/Public Key:', keyPair.publicKey);
console.log('私钥/Secret Key:', keyPair.secretKey);

// 签名数据 / Sign data
const signer = new Signer(keyPair.secretKey);
const record = { id: '123', action: 'test', timestamp: Date.now() };
const signature = signer.sign(JSON.stringify(record));

// 验证签名 / Verify signature
const isValid = Signer.verify(
  JSON.stringify(record),
  signature,
  keyPair.publicKey
);
console.log('签名有效/Valid:', isValid); // true

// 篡改数据后验证 / Verify after tampering
const tampered = { ...record, action: 'hacked' };
const isTampered = Signer.verify(
  JSON.stringify(tampered),
  signature,
  keyPair.publicKey
);
console.log('篡改后有效/Valid after tamper:', isTampered); // false
```

---

## 🔧 完整示例 / Complete Example

```typescript
import { Recorder, Redactor, Academy, Signer } from 'lobster-academy';

// 1. 初始化组件 / Initialize components
const recorder = new Recorder({ agentId: 'my-agent' });
const redactor = new Redactor();
const academy = new Academy({ agentId: 'my-agent' });
const keyPair = Signer.generateKeyPair();
const signer = new Signer(keyPair.secretKey);

// 2. Agent 处理用户请求 / Agent handles user request
async function handleUserRequest(message: string) {
  // 脱敏用户输入 / Redact user input
  const safeMessage = redactor.redactString(message);
  
  // Agent 处理逻辑 / Agent processing logic
  const response = await myAgent.process(safeMessage);
  
  // 脱敏 Agent 输出 / Redact Agent output
  const safeResponse = redactor.redactObject(response);
  
  // 录制决策 / Record decision
  const record = {
    type: 'decision' as const,
    input: { userMessage: safeMessage },
    output: safeResponse,
    timestamp: Date.now(),
  };
  
  // 签名记录 / Sign record
  const signature = signer.sign(JSON.stringify(record));
  record.signature = signature;
  
  // 保存记录 / Save record
  await recorder.record(record);
  
  return safeResponse;
}

// 3. 定期运行评测 / Run evaluation periodically
async function runEvaluation() {
  const result = await academy.evaluate();
  console.log('Agent 评分/Score:', result.grade);
  
  if (result.totalScore < 80) {
    console.log('⚠️ Agent 需要改进 / Agent needs improvement');
  }
}

// 4. 生成审计报告 / Generate audit report
async function generateAuditReport() {
  const report = await academy.generateReport({
    from: '2026-03-01',
    to: '2026-03-31',
  });
  
  console.log('审计报告/Audit Report:', report.summary);
  return report;
}
```

---

## 📊 存储配置 / Storage Configuration

### 内存模式（开发环境）/ In-Memory Mode (Development)

```typescript
import { InMemoryStorage } from 'lobster-academy/storage';

const storage = new InMemoryStorage();

const recorder = new Recorder({
  agentId: 'my-agent',
  storage,
});
```

### PostgreSQL（生产环境）/ PostgreSQL (Production)

```typescript
import { PgStorage } from 'lobster-academy/storage';

const storage = new PgStorage({
  connectionString: process.env.DATABASE_URL,
  max: 20, // 最大连接数 / Max connections
});

await storage.initialize();

const recorder = new Recorder({
  agentId: 'my-agent',
  storage,
});
```

---

## 🎓 下一步 / Next Steps

- [API 参考 / API Reference](api-reference.md) — 完整 API 文档 / Complete API documentation
- [脱敏规则 / Redaction Rules](redaction.md) — 200+ 种模式详解 / 200+ pattern details
- [评测标准 / Evaluation Criteria](evaluation.md) — 5 维度 25 项指标 / 5 dimensions 25 metrics
- [安全指南 / Security Guide](security.md) — 安全最佳实践 / Security best practices
- [存储后端 / Storage Backend](storage.md) — 存储配置详解 / Storage configuration details
