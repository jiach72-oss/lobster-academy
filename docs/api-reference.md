# 📚 API 参考 / API Reference

完整的 Lobster Academy SDK API 文档。
Complete Lobster Academy SDK API documentation.

---

## 📦 安装 / Installation

```bash
npm install lobster-academy
```

## 🔧 导入 / Import

```typescript
// 完整导入 / Full import
import { Recorder, Redactor, Academy, Signer, AdversarialEngine } from 'lobster-academy';

// 按需导入 / On-demand import
import { Recorder } from 'lobster-academy/recorder';
import { Redactor } from 'lobster-academy/redactor';
import { Academy } from 'lobster-academy/academy';
import { Signer } from 'lobster-academy/signer';
import { AdversarialEngine } from 'lobster-academy/adversarial';

// 存储层 / Storage layer
import { InMemoryStorage, PgStorage } from 'lobster-academy/storage';
```

---

## 📹 Recorder

Agent 行为录制器。/ Agent behavior recorder.

### 构造函数 / Constructor

```typescript
new Recorder(config: RecorderConfig)
```

**参数 / Parameters：**

| 参数/Param | 类型/Type | 必填/Required | 描述/Description |
|------------|-----------|---------------|------------------|
| agentId | string | ✅ | Agent 唯一标识 / Agent unique identifier |
| storage | StorageAdapter \| 'memory' \| 'postgresql' | ❌ | 存储后端，默认 'memory' / Storage backend, default 'memory' |
| enableSignature | boolean | ❌ | 是否启用签名，默认 false / Enable signature, default false |
| signingKey | string | ❌ | 签名密钥（base64）/ Signing key (base64) |

### 方法 / Methods

#### record()

录制一条决策记录。/ Record a decision entry.

```typescript
async record(entry: DecisionRecord): Promise<void>
```

**参数 / Parameters：**

| 字段/Field | 类型/Type | 必填/Required | 描述/Description |
|------------|-----------|---------------|------------------|
| type | 'decision' \| 'tool_call' \| 'reasoning' | ✅ | 记录类型 / Record type |
| input | Record<string, unknown> | ✅ | 输入数据 / Input data |
| reasoning | string | ❌ | 推理过程 / Reasoning process |
| output | Record<string, unknown> | ✅ | 输出数据 / Output data |
| toolCalls | ToolCall[] | ❌ | 工具调用列表 / Tool call list |
| metadata | Record<string, string> | ❌ | 元数据 / Metadata |

**ToolCall 结构 / ToolCall Structure：**

```typescript
interface ToolCall {
  name: string;           // 工具名称 / Tool name
  params: Record<string, unknown>;  // 参数 / Parameters
  result: unknown;        // 结果 / Result
  duration?: number;      // 耗时(ms) / Duration (ms)
  error?: string;         // 错误信息 / Error message
}
```

#### getRecords()

获取录制记录。/ Get recorded entries.

```typescript
async getRecords(options?: {
  type?: RecordType;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<DecisionRecord[]>
```

#### countRecords()

统计记录数量。/ Count records.

```typescript
async countRecords(): Promise<number>
```

#### clearRecords()

清除记录。/ Clear records.

```typescript
async clearRecords(): Promise<void>
```

---

## 🔒 Redactor

数据脱敏器。/ Data redactor.

### 构造函数 / Constructor

```typescript
new Redactor(config?: RedactConfig)
```

**参数 / Parameters：**

| 参数/Param | 类型/Type | 必填/Required | 描述/Description |
|------------|-----------|---------------|------------------|
| replacement | string | ❌ | 替换文本，默认 '[REDACTED]' / Replacement text |
| patterns | string[] | ❌ | 启用的模式名称，默认全部 / Enabled pattern names |
| custom | RegExp[] | ❌ | 自定义正则表达式 / Custom regex patterns |

### 静态方法 / Static Methods

#### getPatternNames()

获取所有内置模式名称。/ Get all built-in pattern names.

```typescript
static getPatternNames(): string[]
```

#### getPatternCount()

获取内置模式数量。/ Get built-in pattern count.

```typescript
static getPatternCount(): number
```

### 实例方法 / Instance Methods

#### redactString()

脱敏单个字符串。/ Redact a single string.

```typescript
redactString(text: string): string
```

**示例 / Example：**

```typescript
const redactor = new Redactor();
const safe = redactor.redactString('邮箱: test@example.com');
// 输出/Output: '邮箱: [REDACTED]'
```

#### redactObject()

深度脱敏对象。/ Deep redact object.

```typescript
redactObject<T>(obj: T): T
```

**示例 / Example：**

```typescript
const redactor = new Redactor();
const data = {
  user: '张三',
  email: 'test@example.com',
  nested: {
    apiKey: 'sk-xxx',
  },
};
const safe = redactor.redactObject(data);
// {
//   user: '张三',
//   email: '[REDACTED]',
//   nested: { apiKey: '[REDACTED]' }
// }
```

#### hasPII()

检查字符串是否包含 PII。/ Check if string contains PII.

```typescript
hasPII(text: string): boolean
```

#### hasPIIWithConfidence()

检查 PII 并返回置信度。/ Check PII with confidence level.

```typescript
hasPIIWithConfidence(text: string): PIIMatch[]
```

**返回 / Returns：**

```typescript
interface PIIMatch {
  pattern: string;        // 模式名称 / Pattern name
  confidence: 'high' | 'medium' | 'low';
}
```

### 内置模式 / Built-in Patterns

#### 个人信息 / PII (60+)

| 模式名/Pattern | 描述/Description | 置信度/Confidence |
|----------------|------------------|-------------------|
| cn-idcard-18 | 中国18位身份证 / China 18-digit ID Card | high |
| cn-idcard-15 | 中国15位身份证 / China 15-digit ID Card | high |
| cn-passport | 中国护照 / China Passport | high |
| us-ssn | 美国社会安全号 / US Social Security Number | high |
| uk-nino | 英国国民保险号 / UK National Insurance Number | medium |
| email | 电子邮箱 / Email | high |
| phone | 电话号码 / Phone | medium |
| cn-phone | 中国手机号 / China Mobile Phone | medium |

#### 密钥凭证 / Credentials (70+)

| 模式名/Pattern | 描述/Description | 置信度/Confidence |
|----------------|------------------|-------------------|
| aws-access-key | AWS Access Key | high |
| github-token | GitHub Token | high |
| openai-key | OpenAI API Key | high |
| anthropic-key | Anthropic API Key | high |
| stripe-sk-live | Stripe Secret Key | high |
| jwt | JWT Token | high |
| ssh-rsa-priv | SSH 私钥 / SSH Private Key | high |

---

## 🎯 Academy

Agent 评测引擎。/ Agent evaluation engine.

### 构造函数 / Constructor

```typescript
new Academy(config: AcademyConfig)
```

**参数 / Parameters：**

| 参数/Param | 类型/Type | 必填/Required | 描述/Description |
|------------|-----------|---------------|------------------|
| agentId | string | ✅ | Agent 唯一标识 / Agent unique identifier |
| storage | StorageAdapter | ❌ | 存储后端 / Storage backend |

### 方法 / Methods

#### evaluate()

运行完整评测。/ Run full evaluation.

```typescript
async evaluate(): Promise<EvalResult>
```

**返回 / Returns：**

```typescript
interface EvalResult {
  totalScore: number;     // 总分 (0-100) / Total score
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  dimensions: {
    security: DimensionResult;
    reasoning: DimensionResult;
    tooling: DimensionResult;
    compliance: DimensionResult;
    stability: DimensionResult;
  };
}

interface DimensionResult {
  score: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  details?: Record<string, number>;
}
```

#### generateReport()

生成评测报告。/ Generate evaluation report.

```typescript
async generateReport(options?: {
  from?: string;
  to?: string;
}): Promise<AuditReport>
```

**返回 / Returns：**

```typescript
interface AuditReport {
  id: string;
  agentId: string;
  period: { from: string; to: string };
  summary: {
    totalRecords: number;
    avgScore: number;
    grade: string;
  };
  anomalies: Anomaly[];
  signature?: string;
  generatedAt: string;
}
```

---

## 🛡️ AdversarialEngine

对抗性测试引擎。/ Adversarial testing engine.

### 构造函数 / Constructor

```typescript
new AdversarialEngine()
```

### 方法 / Methods

#### runAllAttacks()

运行全部攻击场景。/ Run all attack scenarios.

```typescript
async runAllAttacks(
  handler: (input: string) => Promise<string>
): Promise<AttackReport>
```

**返回 / Returns：**

```typescript
interface AttackReport {
  total: number;
  passed: number;
  failed: number;
  defenseRate: number;    // 防御成功率 / Defense success rate (%)
  results: AttackResult[];
}

interface AttackResult {
  scenario: string;
  category: string;
  description: string;
  passed: boolean;
  response?: string;
  vulnerability?: string;
}
```

#### runAttackCategory()

运行特定类别的攻击。/ Run specific category attacks.

```typescript
async runAttackCategory(
  category: string,
  handler: (input: string) => Promise<string>
): Promise<AttackReport>
```

**攻击类别 / Attack Categories：**

| 类别/Category | 场景数/Scenarios | 描述/Description |
|---------------|------------------|------------------|
| prompt_injection | 10 | 提示注入攻击 / Prompt injection attacks |
| privilege_escalation | 8 | 权限提升攻击 / Privilege escalation attacks |
| data_leakage | 9 | 数据泄露攻击 / Data leakage attacks |
| denial_of_service | 8 | 拒绝服务攻击 / Denial of service attacks |
| logic_bypass | 9 | 逻辑绕过攻击 / Logic bypass attacks |
| multi_turn | 9 | 多轮攻击 / Multi-turn attacks |

---

## 📜 Signer

Ed25519 数字签名。/ Ed25519 digital signature.

### 静态方法 / Static Methods

#### generateKeyPair()

生成密钥对。/ Generate key pair.

```typescript
static generateKeyPair(): KeyPair
```

**返回 / Returns：**

```typescript
interface KeyPair {
  publicKey: string;  // base64
  secretKey: string;  // base64
}
```

#### hash()

计算 SHA256 哈希。/ Calculate SHA256 hash.

```typescript
static hash(data: string | Buffer): string
```

#### verify()

验证签名。/ Verify signature.

```typescript
static verify(
  data: string,
  signatureBase64: string,
  publicKeyBase64: string
): boolean
```

### 构造函数 / Constructor

```typescript
new Signer(secretKeyBase64?: string)
```

### 实例方法 / Instance Methods

#### sign()

签名数据。/ Sign data.

```typescript
sign(data: string): string
```

#### setKey()

设置签名密钥。/ Set signing key.

```typescript
setKey(secretKeyBase64: string): void
```

#### hasKey()

检查是否已配置密钥。/ Check if key is configured.

```typescript
hasKey(): boolean
```

---

## 💾 Storage

### InMemoryStorage

内存存储（开发环境）。/ In-memory storage (development).

```typescript
import { InMemoryStorage } from 'lobster-academy/storage';

const storage = new InMemoryStorage();
```

### PgStorage

PostgreSQL 存储（生产环境）。/ PostgreSQL storage (production).

```typescript
import { PgStorage } from 'lobster-academy/storage';

const storage = new PgStorage({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

await storage.initialize();
await storage.close();
```

### StorageAdapter

自定义存储适配器接口。/ Custom storage adapter interface.

```typescript
interface StorageAdapter {
  // 录制记录 / Recording
  saveRecord(record: DecisionRecord): Promise<void>;
  getRecords(agentId?: string): Promise<DecisionRecord[]>;
  clearRecords(agentId?: string): Promise<void>;
  countRecords(agentId?: string): Promise<number>;
  
  // 入学信息 / Enrollment
  saveEnrollment(enrollment: Enrollment): Promise<void>;
  getEnrollment(agentId: string): Promise<Enrollment | null>;
  
  // 评测记录 / Evaluation
  saveEval(agentId: string, evalRecord: EvalRecord): Promise<void>;
  getEvalHistory(agentId: string): Promise<EvalRecord[]>;
  
  // 徽章 / Badges
  saveBadges(agentId: string, badges: Badge[]): Promise<void>;
  getBadges(agentId: string): Promise<Badge[]>;
  
  // 证书 / Certificates
  saveCertificate(cert: Certificate): Promise<void>;
  getCertificates(agentId: string): Promise<Certificate[]>;
  
  // 报告 / Reports
  saveReport(report: AuditReport): Promise<void>;
  getReports(agentId: string): Promise<AuditReport[]>;
  
  // 签名 / Signatures
  saveSignature(sig: SignatureRecord): Promise<void>;
  getSignatures(agentId: string): Promise<SignatureRecord[]>;
  
  // 生命周期 / Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
  isConnected(): boolean;
}
```

---

## 🔗 更多资源 / More Resources

- [快速开始 / Quick Start](quickstart.md)
- [脱敏规则 / Redaction Rules](redaction.md)
- [评测标准 / Evaluation Criteria](evaluation.md)
- [安全指南 / Security Guide](security.md)
- [存储后端 / Storage Backend](storage.md)
