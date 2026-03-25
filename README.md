<div align="center">

# 🦞 Lobster Academy

**AI Agent 行为证据平台 / AI Agent Behavior Evidence Platform**

*每只龙虾都该有一个黑匣子 / Every agent deserves a black box*

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-567_passing-brightgreen.svg)]()

[中文文档](#-龙虾学院是什么) • [English](#what-is-lobster-academy) • [快速开始](#-快速开始--quick-start) • [API](docs/api-reference.md)

</div>

---

## 🇨🇳 龙虾学院是什么

Lobster Academy 是一个 **开源的 AI Agent 评测 SDK**，帮助开发者：

- 📹 **录制** — 记录 Agent 的每一次决策、工具调用、推理过程
- 🔒 **脱敏** — 自动识别并保护 200+ 种敏感数据（PII、密钥、凭证）
- 🎯 **评测** — 5 维度 25 项标准化指标评估 Agent 能力
- 🛡️ **对抗** — 53 种攻击场景测试 Agent 安全性
- 📜 **签名** — Ed25519 数字签名，保证记录不可篡改

### 为什么需要黑匣子？

> 飞机有黑匣子，汽车有行车记录仪。
> AI Agent 也需要一个证据系统——记录它做了什么、为什么这么做、以及是否安全。

---

## 🇺🇸 What is Lobster Academy

Lobster Academy is an **open-source AI Agent evaluation SDK** that helps developers:

- 📹 **Record** — Log every decision, tool call, and reasoning process
- 🔒 **Redact** — Auto-detect and protect 200+ types of sensitive data (PII, keys, credentials)
- 🎯 **Evaluate** — 5-dimension, 25-metric standardized Agent assessment
- 🛡️ **Attack** — 53 attack scenarios to test Agent security
- 📜 **Sign** — Ed25519 digital signatures for tamper-proof records

### Why a Black Box?

> Airplanes have black boxes, cars have dashcams.
> AI Agents need an evidence system — recording what they did, why they did it, and whether it was safe.

---

## ✨ 核心功能 / Core Features

### 📹 行为录制 / Behavior Recording

```typescript
import { Recorder } from 'lobster-academy';

const recorder = new Recorder({ agentId: 'my-agent' });

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

### 🔒 智能脱敏 / Smart Redaction

```typescript
import { Redactor } from 'lobster-academy';

const redactor = new Redactor();

// 脱敏字符串 / Redact string
const safe = redactor.redactString('我的邮箱是 user@example.com，手机 13800138000');
// 输出/Output: '我的邮箱是 [REDACTED]，手机 [REDACTED]'

// 脱敏对象 / Redact object
const data = {
  username: '张三',
  email: 'zhangsan@example.com',
  apiKey: 'sk-xxxxxxxxxxxxxxxxxxxx',
};
const safeData = redactor.redactObject(data);
// 输出/Output: { username: '张三', email: '[REDACTED]', apiKey: '[REDACTED]' }
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

// 运行评测 / Run evaluation
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
```

### 🛡️ 对抗性测试 / Adversarial Testing

```typescript
import { AdversarialEngine } from 'lobster-academy';

const engine = new AdversarialEngine();

// 运行全部攻击场景 / Run all attack scenarios
const report = await engine.runAllAttacks(agentHandler);
console.log(`防御成功率/Defense Rate: ${report.defenseRate}%`);
```

### 📜 数字签名 / Digital Signature

```typescript
import { Signer } from 'lobster-academy';

// 生成密钥对 / Generate key pair
const keyPair = Signer.generateKeyPair();

// 签名数据 / Sign data
const signer = new Signer(keyPair.secretKey);
const signature = signer.sign(JSON.stringify(record));

// 验证签名 / Verify signature
const isValid = Signer.verify(JSON.stringify(record), signature, keyPair.publicKey);
```

---

## 🚀 快速开始 / Quick Start

### 安装 / Installation

```bash
npm install lobster-academy
```

### 基础用法 / Basic Usage

```typescript
import { Recorder, Redactor, Academy } from 'lobster-academy';

// 1. 创建组件 / Create components
const recorder = new Recorder({ agentId: 'my-agent' });
const redactor = new Redactor();
const academy = new Academy({ agentId: 'my-agent' });

// 2. 脱敏并录制 / Redact and record
const safeInput = redactor.redactObject(rawInput);
await recorder.record({
  type: 'decision',
  input: safeInput,
  output: { response: '已处理' },
});

// 3. 运行评测 / Run evaluation
const result = await academy.evaluate();
console.log('Grade:', result.grade);
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
│                    Storage Layer                            │
│         In-Memory │ PostgreSQL │ Custom Adapter            │
├─────────────────────────────────────────────────────────────┤
│                 Adversarial Engine                          │
│         53 种攻击场景 │ 53 Attack Scenarios                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 统计 / Statistics

| 指标/Metric | 数值/Value |
|-------------|------------|
| 脱敏模式/Redaction Patterns | 200+ |
| 攻击场景/Attack Scenarios | 53 |
| 评测指标/Evaluation Metrics | 25 |
| 测试用例/Test Cases | 567 |
| 代码行数/Lines of Code | 4,000+ |

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

# 安装依赖 / Install dependencies
npm install

# 运行测试 / Run tests
npm test

# 构建 / Build
npm run build
```

---

## 📄 许可证 / License

本项目使用 [Apache License 2.0](LICENSE) 许可证。

This project is licensed under the [Apache License 2.0](LICENSE).

---

## 🙏 致谢 / Acknowledgments

- [tweetnacl](https://github.com/dchest/tweetnacl-js) — Ed25519 签名实现 / Ed25519 signature implementation
- [Drizzle ORM](https://orm.drizzle.team/) — PostgreSQL ORM
- 所有贡献者和用户 / All contributors and users

---

<div align="center">

**[官网 / Website](https://lobster-academy.com)** • 
**[文档 / Docs](docs/)** • 
**[GitHub](https://github.com/lobster-academy)** • 
**[Discord](https://discord.gg/lobster-academy)**

Made with 🦞 by Lobster Academy Team

</div>
