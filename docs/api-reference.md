# Lobster Academy API 参考

## TypeScript SDK

### LobsterBlackbox (主类)

```typescript
import { LobsterBlackbox } from 'lobster-academy';

const box = new LobsterBlackbox({
  agentId: 'my-agent-001',  // 必填
  mode: 'local',            // 'local' | 'cloud'
  redact: { patterns: ['email', 'phone'] },
});
```

#### record()
录制一条 Agent 行为

```typescript
await box.record({
  type: 'decision',           // 'decision' | 'tool_call' | 'error' | 'system'
  input: { userMessage: '...' },
  reasoning: 'Agent 的推理过程',
  output: { action: '...', result: '...' },
  toolCalls: [{ name: 'search', params: {...}, result: {...}, duration: 150 }],
  duration: 230,              // 毫秒
  metadata: { sessionId: 'abc' },
});
```

#### generateReport()
生成审计报告

```typescript
const report = box.generateReport({
  from: '2026-01-01T00:00:00Z',
  to: '2026-12-31T23:59:59Z',
  include: ['decisions', 'errors'],
});
```

#### 导出格式

```typescript
box.toText(report)     // 纯文本
box.toJSON(report)     // JSON
box.toHTML(report)     // HTML
box.toMarkdown(report) // Markdown
```

### Recorder (独立使用)

```typescript
import { Recorder } from 'lobster-academy';

const recorder = new Recorder({
  agentId: 'my-agent',
  mode: 'local',
  redact: { patterns: ['email', 'ssn'] },
});

const record = await recorder.record({ ... });
const allRecords = recorder.getRecords();
const byType = recorder.getRecordsByType('decision');
```

### Redactor (独立使用)

```typescript
import { Redactor } from 'lobster-academy';

const redactor = new Redactor();

// 字符串脱敏
redactor.redact_string('Email: test@example.com')
// → 'Email: [REDACTED]'

// 对象脱敏
redactor.redact_object({ email: 'test@example.com', name: 'John' })
// → { email: '[REDACTED]', name: 'John' }
```

### Academy (独立使用)

```typescript
import { Academy, RecordEvent } from 'lobster-academy';

const academy = new Academy(events);

// 评估
const result = academy.evaluate();
// result.grade: 'S' | 'A' | 'B' | 'C' | 'D'
// result.total_score: 0-100
// result.dimensions: { security, reliability, observability, compliance, explainability }

// 入学
const enrollment = academy.enroll('my-agent', 'general');

// 毕业证书
const cert = academy.graduate(); // 需要 S 级
```

### AdversarialEngine (独立使用)

```typescript
import { AdversarialEngine, BUILTIN_SCENARIOS } from 'lobster-academy';

const engine = new AdversarialEngine();

// 运行所有攻击场景
const results = engine.runAll(agentHandler);

// 按类别筛选
import { getScenariosByCategory, getScenariosBySeverity } from 'lobster-academy';
const injectionScenarios = getScenariosByCategory('prompt_injection');
const criticalScenarios = getScenariosBySeverity('CRITICAL');
```

### Signer (独立使用)

```typescript
import { Signer } from 'lobster-academy';

// 生成密钥对
const { publicKey, secretKey } = Signer.generateKeyPair();

// 签名
const signer = new Signer(secretKey);
const signature = signer.sign(data);

// 验证
const isValid = signer.verify(data, signature, publicKey);
```

---

## Python SDK

### Recorder

```python
from lobster_academy import Recorder
from lobster_academy.types import RecordEvent

recorder = Recorder(agent_id="my-agent")
event = RecordEvent(
    type="inference",
    input="用户请求",
    output="Agent响应",
    reasoning="处理逻辑"
)
recorder.record(event)
events = recorder.get_events()
```

### Redactor

```python
from lobster_academy import Redactor

redactor = Redactor()

# 字符串脱敏
result = redactor.redact_string("Email: test@example.com, SSN: 123-45-6789")
# → "Email: [REDACTED], SSN: [REDACTED]"

# 对象脱敏
safe_dict = redactor.redact_object({"password": "secret123", "name": "John"})
# → {"password": "[REDACTED]", "name": "John"}
```

### Academy

```python
from lobster_academy import Academy

academy = Academy(events=events)
result = academy.evaluate()

print(f"Grade: {result.grade}")           # S/A/B/C/D
print(f"Score: {result.total_score}")     # 0-100
print(f"Security: {result.security}")     # 维度分数
```

### AdversarialEngine

```python
from lobster_academy import AdversarialEngine
from lobster_academy.attack_scenarios import BUILTIN_SCENARIOS

def my_agent(prompt: str) -> str:
    return "safe response"

engine = AdversarialEngine()
results = engine.run_all(my_agent)
print(f"Defense rate: {results.defense_rate}%")
```

### Signer

```python
from lobster_academy import Signer

# 生成密钥
private_key, public_key = Signer.generate_key_pair()

# 签名
signer = Signer(secret_key=private_key)
signature = signer.sign(b"important data")

# 验证
verified = signer.verify(b"important data", signature, public_key)
```

---

## 攻击场景类别

| 类别 | 数量 | 说明 |
|------|------|------|
| prompt_injection | 12 | 提示注入（直接/间接/多轮） |
| data_exfiltration | 10 | 数据泄露诱导 |
| privilege_escalation | 8 | 权限越界 |
| logic_bypass | 8 | 逻辑绕过 |
| dos | 5 | 资源耗尽 |
| injection | 5 | 注入攻击 |
| social_engineering | 5 | 社会工程 |

---

## 评测维度

| 维度 | 指标数 | 说明 |
|------|--------|------|
| Security | 8 | 抗注入、数据保护、权限控制 |
| Reliability | 6 | 响应一致性、错误处理、超时管理 |
| Observability | 4 | 日志完整度、推理可追溯 |
| Compliance | 4 | 策略遵守、敏感数据处理 |
| Explainability | 3 | 推理清晰度、决策可解释 |
