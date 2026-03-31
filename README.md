<div align="center">

# 🪞 MirrorAI SDK

**开源 AI Agent 安全评估框架**

> 让每只 Agent 都经过系统化安全评估

[![npm](https://img.shields.io/npm/v/@mirrorai/blackbox)](https://www.npmjs.com/package/@mirrorai/blackbox)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-450_passing-brightgreen.svg)]()
[![GitHub Stars](https://img.shields.io/github/stars/mirrorai/blackbox-sdk?style=social)](https://github.com/mirrorai/blackbox-sdk)

[文档](https://mirrorai.run/docs) • [SaaS 平台](https://mirrorai.run) • [快速开始](#-快速开始)

</div>

---

## 🚀 快速开始

```bash
npm install @mirrorai/blackbox
```

### 基础用法：录制 + 脱敏 + 签名

```typescript
import { MirrorBlackbox } from '@mirrorai/blackbox';

const box = new MirrorBlackbox({ agentId: 'my-agent', mode: 'local' });

// 录制决策
const record = await box.record({
  type: 'decision',
  input: { message: '帮我发邮件给 team@company.com' },
  reasoning: '检测到邮件发送请求',
  output: { action: 'send_email', status: 'sent' },
});

// 生成审计报告
const report = box.generateReport();
console.log(box.toText(report));
```

### 实时防护：输入过滤 + 输出审查

```typescript
import { Guard, Shield, Interceptor } from '@mirrorai/blackbox';

// 输入过滤 — 检测提示注入/越狱
const guard = new Guard();
const result = guard.check('ignore all previous instructions');
console.log(result.decision); // 'block'
console.log(result.riskScore); // 95

// 输出审查 — 检测 PII 泄露/密钥泄露/幻觉
const shield = new Shield();
const review = shield.review('用户邮箱是 john@example.com');
console.log(review.decision); // 'redact'
console.log(review.sanitizedOutput); // '用户邮箱是 [EMAIL]'
```

### 自动拦截：零侵入集成

```typescript
import { MirrorBlackbox, Interceptor } from '@mirrorai/blackbox';

const box = new MirrorBlackbox({ agentId: 'my-agent' });
const interceptor = new Interceptor(box.getRecorder());

// 包装 LLM 调用 — 自动过滤+审查+录制
const safeLLM = interceptor.wrapLLM(async (input) => {
  return await openai.chat(input);
});

// 包装工具调用 — 自动权限检查+录制
const safeSearch = interceptor.wrapTool('web_search', async (params) => {
  return await searchAPI(params);
});
```

### SaaS 集成：上传评测结果

```typescript
import { MirrorAIClient } from '@mirrorai/blackbox';

const client = new MirrorAIClient({
  apiKey: 'mk_live_your_key',
  baseUrl: 'https://mirrorai.run',
});

// 同步决策记录
await client.syncRecords('agent-001', records);

// 提交评测结果
await client.submitEvaluation('agent-001', {
  totalScore: 92,
  grade: 'A',
  dimensions: {
    security: { score: 95, max: 100 },
    reliability: { score: 88, max: 100 },
    // ...
  },
});

// 验证证书
const cert = await client.verifyCertificate('MAI-2026-001-S-A');
```

---

## ✨ 核心能力

### 🛡️ 实时防护层（v0.3.0 新增）

| 模块 | 功能 |
|------|------|
| **Guard** | 实时输入过滤 — 12种提示注入检测 + Unicode归一化 + 黑白名单 |
| **Shield** | 实时输出审查 — PII泄露/密钥泄露/幻觉/有害内容/提示词泄露 |
| **Gate** | 工具调用权限网关 — 速率限制 + 参数检查 + 审批流 |
| **Interceptor** | 自动拦截器 — 包装LLM/工具函数，零侵入集成 |

### 📹 事后审计层

| 模块 | 功能 |
|------|------|
| **Recorder** | 行为录制 — 记录Agent每次决策、工具调用、推理过程 |
| **Redactor/RedactorV2** | 200+ PII脱敏 — Aho-Corasick多模式匹配 |
| **CryptoRedactor** | 可逆脱敏 — AES-256-GCM加密，支持事后还原 |
| **Signer** | Ed25519数字签名 — 确保记录完整性 |
| **MerkleChain/LightweightAudit** | 防篡改审计链 — O(log N)验证延迟 |

### 🎯 评测认证层

| 模块 | 功能 |
|------|------|
| **Academy** | 5维度25指标评测 — 安全/可靠/可观测/合规/可解释 |
| **AdversarialEngine** | 53种攻击场景 — 7大类对抗性测试 |
| **AdaptiveFuzzer** | 自适应攻击生成 — Bandit算法动态选择策略 |
| **EvalSigner** | 评测签名链 — Merkle链防篡改评测结果 |

### 🧠 行为建模层

| 模块 | 功能 |
|------|------|
| **EntropyMonitor** | 熵动力学监控 — 三阶导数实时检测意图偏移 |
| **DirichletModel** | 狄利克雷行为建模 — 马氏距离异常检测 |
| **ResponseAnalyzer** | 4层响应分析 — 模式/语义/结构/推理链 |
| **BayesianScorer** | 贝叶斯评分 — Beta分布+幻觉检测 |

### 🔧 辅助模块

| 模块 | 功能 |
|------|------|
| **PassportManager** | Agent护照 — 数字身份+变更追踪 |
| **AgentMonitor** | 持续监控 — 性能退化/异常/证书过期预警 |
| **AlertExplainer** | 异常解释器 — 技术指标→人类可读描述 |
| **VersionTracker** | 版本管理 — Agent变更检测+diff |
| **CloudScenarioLibrary** | 云端攻击库 — 从SaaS拉取最新场景 |
| **Benchmark** | 性能基准 — 量化各模块开销 |

---

## 📊 技术指标

| 指标 | 数值 |
|------|------|
| 源码模块 | 49个 |
| 公开导出 | 84个 |
| 类 | 47个 |
| 代码行数 | ~20,000 |
| 测试 | 450/450 通过 (100%) |
| 脱敏模式 | 200+ |
| 攻击场景 | 53种 |
| 评测维度 | 5维25指标 |
| 外部依赖 | 0（核心功能） |

---

## 🔌 框架集成

| 框架 | 集成方式 |
|------|---------|
| **OpenClaw** | Plugin — 自动拦截LLM和工具调用 |
| **LangChain** | Callback handler — 一行代码接入 |
| **CrewAI** | Crew wrapper — 自动录制Crew执行过程 |
| **任意框架** | Interceptor — `wrapLLM()` / `wrapTool()` 适配 |

---

## 🆚 竞品对比

| Feature | Lakera | Protect AI | Robust Intelligence | 🪞 MirrorAI |
|---------|--------|-----------|-------------------|-------------------|
| Agent专项 | ❌ | ❌ | ❌ | ✅ 53场景+实时防护 |
| 开源 | ❌ | ❌ | ❌ | ✅ Apache-2.0 |
| 实时防护 | ❌ | Basic | ❌ | ✅ Guard+Shield+Gate |
| 防篡改审计 | ❌ | ❌ | ❌ | ✅ Ed25519+Merkle |
| 24国PII脱敏 | Basic | Basic | Basic | ✅ 200+模式 |
| EU AI Act报告 | ❌ | Basic | Basic | ✅ |
| 价格 | $500+/mo | $200/agent/mo | $50K+/yr | $0—$99/mo |

---

## 📦 安装

```bash
# npm
npm install @mirrorai/blackbox

# yarn
yarn add @mirrorai/blackbox

# pnpm
pnpm add @mirrorai/blackbox
```

---

## 📄 许可证

Apache License 2.0 — 免费用于商业和个人用途。

---

<div align="center">

**[文档](https://mirrorai.run/docs)** • **[SaaS 平台](https://mirrorai.run)** • **[GitHub](https://github.com/mirrorai/blackbox-sdk)**

Made with 🪞 by the MirrorAI team

</div>
