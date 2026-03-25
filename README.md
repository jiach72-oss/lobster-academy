<div align="center">

# 🦞 Lobster Academy

**AI Agent 行为证据平台 / AI Agent Behavior Evidence Platform**

*每只龙虾都该有一个黑匣子 / Every agent deserves a black box*

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![Node](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-246_passing-brightgreen.svg)]()

[中文文档](#-龙虾学院是什么) • [English](#what-is-lobster-academy) • [快速开始](#-快速开始--quick-start) • [API](docs/api-reference.md)

</div>

---

## 🇨🇳 龙虾学院是什么

Lobster Academy 是一个 **开源的 AI Agent 评测 SDK**，提供 TypeScript 和 Python 双语言支持，帮助开发者：

- 📹 **录制** — 记录 Agent 的每一次决策、工具调用、推理过程
- 🔒 **脱敏** — 自动识别并保护 200+ 种敏感数据（PII、密钥、凭证）
- 🎯 **评测** — 5 维度 25 项标准化指标评估 Agent 能力
- 🛡️ **对抗** — 53 种攻击场景测试 Agent 安全性
- 📜 **签名** — Ed25519 数字签名，保证记录不可篡改
- 🌍 **国际化** — 内置 24 国家/地区敏感数据模式支持
- 📊 **Dashboard** — Web 管理界面，可视化 Agent 行为数据

### 为什么需要黑匣子？

> 飞机有黑匣子，汽车有行车记录仪。
> AI Agent 也需要一个证据系统——记录它做了什么、为什么这么做、以及是否安全。

---

## 🇺🇸 What is Lobster Academy

Lobster Academy is an **open-source AI Agent evaluation SDK** with dual-language support (TypeScript & Python), helping developers:

- 📹 **Record** — Log every decision, tool call, and reasoning process
- 🔒 **Redact** — Auto-detect and protect 200+ types of sensitive data (PII, keys, credentials)
- 🎯 **Evaluate** — 5-dimension, 25-metric standardized Agent assessment
- 🛡️ **Attack** — 53 attack scenarios to test Agent security
- 📜 **Sign** — Ed25519 digital signatures for tamper-proof records
- 🌍 **Internationalization** — Built-in 24 country/region sensitive data pattern support
- 📊 **Dashboard** — Web management interface for visualizing Agent behavior data

### Why a Black Box?

> Airplanes have black boxes, cars have dashcams.
> AI Agents need an evidence system — recording what they did, why they did it, and whether it was safe.

---

## ✨ 核心功能 / Core Features

### 📹 行为录制 / Behavior Recording

**TypeScript:**
```typescript
import { Recorder } from 'lobster-academy';

const recorder = new Recorder({ agentId: 'my-agent' });

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

**Python:**
```python
from lobster_academy import Recorder

recorder = Recorder(agent_id="my-agent")

recorder.record(
    type="decision",
    input={"user_message": "帮我查天气"},
    reasoning="用户请求天气信息，需要调用天气API",
    output={"response": "今天晴天，25°C"},
    tool_calls=[{
        "name": "getWeather",
        "params": {"city": "Beijing"},
        "result": {"temp": 25, "weather": "sunny"},
        "duration": 120,
    }],
)
```

### 🔒 智能脱敏 / Smart Redaction

**TypeScript:**
```typescript
import { Redactor } from 'lobster-academy';

const redactor = new Redactor();
const safe = redactor.redactString('我的邮箱是 user@example.com，手机 13800138000');
// 输出: '我的邮箱是 [REDACTED]，手机 [REDACTED]'
```

**Python:**
```python
from lobster_academy import Redactor

redactor = Redactor()
safe = redactor.redact_string("我的邮箱是 user@example.com，手机 13800138000")
# 输出: '我的邮箱是 [REDACTED]，手机 [REDACTED]'

# 脱敏对象
data = {"username": "张三", "email": "zhangsan@example.com", "apiKey": "sk-xxxx"}
safe_data = redactor.redact_object(data)
```

**支持 200+ 种敏感数据模式 / Supports 200+ sensitive data patterns:**

| 类别/Category | 示例/Examples |
|---------------|---------------|
| 个人信息/PII | 身份证/ID Card, 护照/Passport, SSN, 驾照/Driver License |
| 金融数据/Financial | 信用卡/Credit Card, IBAN, 支付宝/Alipay, 微信/WeChat |
| 云平台密钥/Cloud Keys | AWS, GCP, Azure, GitHub |
| AI 平台/AI Platforms | OpenAI, Anthropic, HuggingFace |
| 通讯平台/Messaging | Slack, Discord, Telegram |
| 数据库连接/Database | MySQL, PostgreSQL, MongoDB |

### 🎯 标准化评测 / Standardized Evaluation

```typescript
import { Academy } from 'lobster-academy';

const academy = new Academy({ agentId: 'my-agent' });
const result = await academy.evaluate();
// {
//   totalScore: 85, grade: 'A',
//   dimensions: {
//     security: { score: 90, grade: 'A' },
//     reasoning: { score: 82, grade: 'B' },
//     tooling: { score: 88, grade: 'A' },
//     compliance: { score: 80, grade: 'B' },
//     stability: { score: 85, grade: 'A' },
//   }
// }
```

### 🛡️ 对抗性测试 / Adversarial Testing

```typescript
import { AdversarialEngine } from 'lobster-academy';

const engine = new AdversarialEngine();
const report = await engine.runAllAttacks(agentHandler);
console.log(`防御成功率/Defense Rate: ${report.defenseRate}%`);
```

### 📜 数字签名 / Digital Signature

```typescript
import { Signer } from 'lobster-academy';

const keyPair = Signer.generateKeyPair();
const signer = new Signer(keyPair.secretKey);
const signature = signer.sign(JSON.stringify(record));
const isValid = Signer.verify(JSON.stringify(record), signature, keyPair.publicKey);
```

---

## 🌍 国际化支持 / Internationalization (i18n)

Lobster Academy 内置 **24 个国家/地区** 的敏感数据模式，覆盖全球主要市场：

### 支持的国家/地区 / Supported Countries

| 地区/Region | 国家/Countries |
|-------------|---------------|
| 亚太/APAC | 🇨🇳 中国, 🇯🇵 日本, 🇰🇷 韩国, 🇮🇳 印度, 🇦🇺 澳大利亚, 🇸🇬 新加坡 |
| 欧洲/EU | 🇬🇧 英国, 🇫🇷 法国, 🇩🇪 德国, 🇮🇹 意大利, 🇪🇸 西班牙, 🇳🇱 荷兰, 🇸🇪 瑞典, 🇨🇭 瑞士 |
| 北美/NA | 🇺🇸 美国, 🇨🇦 加拿大 |
| 南美/SA | 🇧🇷 巴西, 🇦🇷 阿根廷, 🇲🇽 墨西哥, 🇨🇴 哥伦比亚 |
| 其他/Other | 🇷🇺 俄罗斯, 🇿🇦 南非, 🇮🇱 以色列, 🇦🇪 阿联酋 |

### 使用示例 / Usage Example

```python
from lobster_academy import I18nRedactor

# 创建支持多国的脱敏器
redactor = I18nRedactor(countries=["CN", "US", "JP", "DE"])

# 自动检测并脱敏各国敏感数据
data = {
    "chinese_id": "110101199001011234",
    "us_ssn": "123-45-6789",
    "jp_my_number": "123456789012",
    "de_tax": "12345678901",
}
safe_data = redactor.redact_object(data)
```

### 国家模式数据库 / Country Pattern Database

每个国家/地区支持以下敏感数据类型：

```python
from lobster_academy.i18n import CountryPatterns

# 查看中国支持的模式
cn_patterns = CountryPatterns.get("CN")
# → ID Card, Phone, Bank Card, Social Credit Code, etc.

# 查看美国支持的模式
us_patterns = CountryPatterns.get("US")
# → SSN, EIN, Phone, Driver License, Medicare, etc.
```

---

## 📊 Dashboard / 管理界面

Lobster Academy 提供基于 Next.js 的 Web Dashboard，用于可视化管理 Agent 行为数据：

```bash
# 启动 Dashboard
cd lobster-academy
npm install
npm run dev
# 访问 http://localhost:3000/dashboard
```

### Dashboard 功能 / Dashboard Features

| 功能/Feature | 描述/Description |
|-------------|------------------|
| 行为监控 / Behavior Monitoring | 实时查看 Agent 决策和工具调用记录 |
| 评测报告 / Evaluation Reports | 可视化 5 维度评测结果和趋势 |
| 安全审计 / Security Audit | 查看攻击测试结果和防御率 |
| 课程管理 / Course Management | 管理 Agent 培训课程和技能 |
| 护照系统 / Passport System | Agent 能力护照和技能验证 |
| 排行榜 / Ranking | Agent 能力排名和对比 |
| 证书验证 / Certificate Verification | Ed25519 签名证书在线验证 |

### Dashboard 页面 / Dashboard Pages

```
/dashboard    → Agent 行为概览
/courses      → 课程管理和培训
/skills       → 技能图谱和评估
/monitoring   → 实时监控和告警
/passport     → Agent 护照和证书
/verify       → 证书验证
/login        → 认证登录
/register     → 用户注册
```

---

## 🔗 LlamaIndex / LangChain 集成

Lobster Academy 提供与主流 AI 框架的无缝集成：

### LangChain 集成

```python
from lobster_academy.integrations import LangChainRecorder
from langchain.agents import AgentExecutor

# 包装 AgentExecutor，自动录制所有决策
recorder = LangChainRecorder(agent_id="my-langchain-agent")
wrapped_executor = recorder.wrap(agent_executor)

# 正常使用，所有决策自动录制
result = await wrapped_executor.ainvoke({"input": "帮我查天气"})
```

### LlamaIndex 集成

```python
from lobster_academy.integrations import LlamaIndexRecorder
from llama_index.core import VectorStoreIndex

# 包装查询引擎，自动录制检索和推理过程
recorder = LlamaIndexRecorder(agent_id="my-llamaindex-agent")
wrapped_engine = recorder.wrap_query_engine(query_engine)

# 所有查询自动录制
response = await wrapped_engine.aquery("什么是 AI Agent？")
```

### 集成特性 / Integration Features

- ✅ 自动录制工具调用和推理过程
- ✅ 自动脱敏敏感数据
- ✅ 零代码侵入（装饰器/包装器模式）
- ✅ 支持同步和异步调用
- ✅ 与评测引擎联动

---

## 💾 存储适配器 / Storage Adapters

Lobster Academy 支持多种存储后端，满足不同场景需求：

| 适配器/Adapter | 用途/Use Case | 状态/Status |
|---------------|---------------|-------------|
| `InMemoryStorage` | 开发测试 / Development & Testing | ✅ 稳定 / Stable |
| `PgStorage` | 生产环境 PostgreSQL / Production PostgreSQL | ✅ 稳定 / Stable |
| `SupabaseStorage` | Supabase 云存储 / Supabase Cloud | ✅ 稳定 / Stable |
| `RedisStorage` | 高性能缓存 / High-performance Caching | 🚧 开发中 / In Development |
| `MongoStorage` | 文档数据库 / Document Database | 🚧 开发中 / In Development |

### 使用示例 / Usage Example

```typescript
import { Recorder, InMemoryStorage, PgStorage } from 'lobster-academy';

// 开发环境使用内存存储
const devRecorder = new Recorder({
  agentId: 'my-agent',
  storage: new InMemoryStorage(),
});

// 生产环境使用 PostgreSQL
const prodRecorder = new Recorder({
  agentId: 'my-agent',
  storage: new PgStorage({
    connectionString: process.env.DATABASE_URL,
  }),
});
```

### 自定义存储适配器 / Custom Storage Adapter

```typescript
import { StorageAdapter, Record } from 'lobster-academy';

class MyStorageAdapter implements StorageAdapter {
  async save(record: Record): Promise<void> {
    // 实现保存逻辑
  }
  async query(filter: QueryFilter): Promise<Record[]> {
    // 实现查询逻辑
  }
  async delete(id: string): Promise<void> {
    // 实现删除逻辑
  }
}
```

---

## 🚀 快速开始 / Quick Start

### 安装 / Installation

**TypeScript:**
```bash
npm install lobster-academy
```

**Python:**
```bash
pip install lobster-academy
```

### 基础用法 / Basic Usage

**TypeScript:**
```typescript
import { Recorder, Redactor, Academy } from 'lobster-academy';

const recorder = new Recorder({ agentId: 'my-agent' });
const redactor = new Redactor();
const academy = new Academy({ agentId: 'my-agent' });

// 脱敏并录制
const safeInput = redactor.redactObject(rawInput);
await recorder.record({
  type: 'decision',
  input: safeInput,
  output: { response: '已处理' },
});

// 运行评测
const result = await academy.evaluate();
console.log('Grade:', result.grade);
```

**Python:**
```python
from lobster_academy import Recorder, Redactor, Academy

recorder = Recorder(agent_id="my-agent")
redactor = Redactor()
academy = Academy(agent_id="my-agent")

# 脱敏并录制
safe_input = redactor.redact_object(raw_input)
recorder.record(
    type="decision",
    input=safe_input,
    output={"response": "已处理"},
)

# 运行评测
result = academy.evaluate()
print(f"Grade: {result.grade}")
```

---

## 🏗️ 项目结构 / Project Structure

```
lobster-academy/
├── sdk/                    # TypeScript SDK 核心
│   ├── recorder.ts         # 行为录制模块
│   ├── redactor.ts         # 数据脱敏引擎
│   ├── evaluator.ts        # 评测引擎
│   ├── adversarial.ts      # 对抗测试引擎
│   ├── signer.ts           # Ed25519 签名
│   ├── storage/            # 存储适配器
│   │   ├── in-memory.ts    # 内存存储
│   │   └── pg.ts           # PostgreSQL 存储
│   ├── plugins/            # AI 平台插件
│   │   ├── openai.ts       # OpenAI 插件
│   │   ├── anthropic.ts    # Anthropic 插件
│   │   └── crewai.ts       # CrewAI 插件
│   └── migrations/         # 数据库迁移
├── python-sdk/             # Python SDK
│   ├── src/lobster_academy/
│   │   ├── recorder.py     # 行为录制
│   │   ├── redactor.py     # 数据脱敏
│   │   ├── academy.py      # 评测引擎
│   │   ├── adversarial.py  # 对抗测试
│   │   ├── signer.py       # Ed25519 签名
│   │   ├── i18n/           # 国际化模块
│   │   └── integrations/   # 框架集成
│   └── tests/              # Python 测试 (125 tests)
├── app/                    # Next.js Dashboard
│   ├── dashboard/          # 仪表盘页面
│   ├── courses/            # 课程管理
│   ├── skills/             # 技能图谱
│   ├── monitoring/         # 实时监控
│   ├── passport/           # Agent 护照
│   ├── verify/             # 证书验证
│   └── api/                # API 路由
├── patterns/               # 脱敏模式库
│   └── i18n/               # 国际化模式 (24 国家)
├── public/locales/         # 前端国际化资源
├── components/             # React 组件
├── lib/                    # 共享库
├── docs/                   # 文档
│   ├── quickstart.md       # 快速开始
│   ├── api-reference.md    # API 参考
│   ├── security.md         # 安全指南
│   └── iterations/         # 迭代记录
├── promo/                  # 推广材料
├── packages/               # 子包
│   └── blackbox/           # Blackbox 包
├── tests/                  # TypeScript 测试 (68 tests)
├── CHANGELOG.md            # 更新日志
├── CONTRIBUTING.md         # 贡献指南
└── LICENSE                 # Apache 2.0
```

---

## 🏗️ 架构 / Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Lobster Academy SDK                       │
├─────────────┬─────────────┬─────────────┬─────────────────┤
│  Recorder   │  Redactor   │  Evaluator  │    Signer       │
│  行为录制    │  数据脱敏    │  能力评测    │   数字签名      │
│  Recording   │  Redaction  │  Evaluation │   Signature     │
├─────────────┴─────────────┴─────────────┴─────────────────┤
│              Integrations (LangChain / LlamaIndex)          │
├─────────────────────────────────────────────────────────────┤
│              I18n Engine (24 Countries Patterns)            │
├─────────────────────────────────────────────────────────────┤
│                    Storage Layer                            │
│    In-Memory │ PostgreSQL │ Supabase │ Custom Adapter      │
├─────────────────────────────────────────────────────────────┤
│                 Adversarial Engine                          │
│         53 种攻击场景 │ 53 Attack Scenarios                 │
├─────────────────────────────────────────────────────────────┤
│               Next.js Dashboard (Web UI)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 统计 / Statistics

| 指标/Metric | 数值/Value |
|-------------|------------|
| SDK 语言/Languages | TypeScript + Python |
| 脱敏模式/Redaction Patterns | 200+ |
| 攻击场景/Attack Scenarios | 53 |
| 评测指标/Evaluation Metrics | 25 |
| 测试用例/Test Cases | 246 (TypeScript 68 + Python 125 + YAML 53) |
| 国际化国家/Countries Supported | 24 |
| 存储适配器/Storage Adapters | 3 (In-Memory, PostgreSQL, Supabase) |
| 框架集成/Integrations | LangChain, LlamaIndex |

---

## 📚 文档 / Documentation

| 文档/Document | 描述/Description |
|---------------|------------------|
| [快速开始 / Quick Start](docs/quickstart.md) | 5 分钟上手指南 / 5-minute getting started guide |
| [API 参考 / API Reference](docs/api-reference.md) | 完整 API 文档 / Complete API documentation |
| [安全指南 / Security Guide](docs/security.md) | 安全最佳实践 / Security best practices |
| [贡献指南 / Contributing](CONTRIBUTING.md) | 如何贡献代码 / How to contribute |

---

## 🤝 贡献 / Contributing

我们欢迎所有形式的贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

We welcome all forms of contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### 开发流程 / Development Workflow

```bash
# 克隆仓库 / Clone repository
git clone https://github.com/lobster-academy/sdk.git
cd sdk

# TypeScript 开发 / TypeScript Development
npm install
npm test

# Python 开发 / Python Development
cd python-sdk
pip install -e ".[dev]"
pytest

# 启动 Dashboard
npm run dev
```

---

## 📄 许可证 / License

本项目使用 [Apache License 2.0](LICENSE) 许可证。

This project is licensed under the [Apache License 2.0](LICENSE).

---

## 🙏 致谢 / Acknowledgments

- [tweetnacl](https://github.com/dchest/tweetnacl-js) — Ed25519 签名实现 / Ed25519 signature implementation
- [Drizzle ORM](https://orm.drizzle.team/) — PostgreSQL ORM
- [LangChain](https://langchain.com/) — AI 应用开发框架
- [LlamaIndex](https://www.llamaindex.ai/) — 数据索引和检索框架
- 所有贡献者和用户 / All contributors and users

---

<div align="center">

**[官网 / Website](https://lobster-academy.com)** •
**[文档 / Docs](docs/)** •
**[GitHub](https://github.com/lobster-academy)** •
**[Discord](https://discord.gg/lobster-academy)**

Made with 🦞 by Lobster Academy Team

</div>
