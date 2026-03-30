<p align="center">
  <b>⭐ If you find this useful, please star this repo to support the project!</b>
</p>

<div align="center">

# 🦞 Lobster Academy

**开源 AI Agent 安全评估框架 / Open-Source AI Agent Security Evaluation Framework**

> 让每只 Agent 都经过系统化安全评估

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![Tests](https://img.shields.io/badge/Tests-566_passing-brightgreen.svg)]()
[![Scenarios](https://img.shields.io/badge/Attack_Scenarios-53-red.svg)]()
[![GitHub Stars](https://img.shields.io/github/stars/jiach72-oss/lobster-academy?style=social)](https://github.com/jiach72-oss/lobster-academy/stargazers)
[![npm version](https://img.shields.io/npm/v/lobster-academy.svg)](https://www.npmjs.com/package/lobster-academy)
[![Downloads](https://img.shields.io/npm/dm/lobster-academy.svg)](https://www.npmjs.com/package/lobster-academy)

[中文文档](#-龙虾学院是什么) • [English](#what-is-lobster-academy) • [快速开始](#-快速开始--quick-start) • [API](docs/api-reference.md)

</div>

---

## 🇨🇳 龙虾学院是什么

Lobster Academy 是一个**开源的 AI Agent 安全评估框架**——为你的 Agent 提供标准化的行为录制、智能脱敏、多维度评测和对抗性安全测试。

**核心理念：** 不是给 Agent 发证书，而是提供一套科学、可复现的评估工具，让企业、审计机构和开发者都能验证 Agent 的安全性与可靠性。

### 为什么需要 Agent 评估？

- **62% 的企业 AI 工具**未经安全审查就已上线
- Agent 具备工具调用能力，**攻击面远超传统 LLM**
- EU AI Act 等法规要求高风险 AI 系统**可审计、可追溯**
- 一次性测试无法覆盖**部署后的持续风险**

---

## 🇺🇸 What is Lobster Academy

Lobster Academy is an **open-source AI Agent security evaluation framework** — providing standardized behavior recording, smart redaction, multi-dimensional evaluation, and adversarial security testing for your agents.

**Core philosophy:** We don't certify agents — we provide scientific, reproducible evaluation tools that enterprises, auditors, and developers can use to verify agent security and reliability.

---

## ✨ 核心能力 / Core Capabilities

| 能力 | 说明 | 状态 |
|------|------|------|
| 📹 **行为录制** | 记录 Agent 每次决策、工具调用、推理过程 | ✅ 生产就绪 |
| 🔒 **智能脱敏** | 自动检测 200+ 种敏感数据（PII/密钥/Token），覆盖 24 国 | ✅ 生产就绪 |
| 🎯 **多维评测** | 5 维度 25 项指标：安全、可靠性、可观测、合规、可解释性 | ✅ 生产就绪 |
| 🛡️ **对抗性测试** | 53 种攻击场景（提示注入/数据泄露/权限越界/逻辑绕过） | ✅ 生产就绪 |
| 🔐 **防篡改签名** | Ed25519 数字签名 + Merkle 链，确保记录完整性 | ✅ 生产就绪 |
| 📡 **持续监控** | 性能退化检测、异常行为预警、证书过期提醒 | ✅ 可用 |
| 🛂 **Agent 护照** | 可验证身份、变更追踪、权限审计 | ✅ 可用 |
| 📊 **合规报告** | EU AI Act / SOC2 一键生成 | ✅ 可用 |

### ⚡ 快速体验 / Quick Try

```bash
# Install 安装
npm install lobster-academy

# Or try instantly 或者立即体验
npx lobster-academy check my-agent
```

---

## 🆚 Why Lobster Academy / 为什么选择我们

| Feature | Lakera | Protect AI | Robust Intelligence | 🦞 Lobster Academy |
|---------|--------|-----------|-------------------|-------------------|
| Agent-Specific / Agent专项 | ❌ | ❌ | ❌ | ✅ 53 scenarios |
| Open Source / 开源 | ❌ | ❌ | ❌ | ✅ |
| Tamper-Proof Audit / 防篡改审计 | ❌ | ❌ | ❌ | ✅ Ed25519 + Merkle |
| PII Redaction (24 countries) / 24国脱敏 | Basic | Basic | Basic | ✅ 200+ patterns |
| EU AI Act Reports / 合规报告 | ❌ | Basic | Basic | ✅ One-click |
| Price / 价格 | $500+/mo | $200/agent/mo | $50K+/yr | $0 — $99/mo |

---

## 🚀 快速开始 / Quick Start

### TypeScript SDK

```typescript
import { LobsterBlackbox } from 'lobster-academy';

const box = new LobsterBlackbox({ agentId: 'my-agent', mode: 'local' });

// 录制行为
await box.record({
  type: 'decision',
  input: { userMessage: '帮我发邮件' },
  reasoning: '检测到邮件发送请求',
  output: { action: 'send_email', status: 'sent' },
});

// 生成评估报告
const report = box.generateReport();
console.log(box.toText(report));
```

### Python SDK

```python
from lobster_academy import Recorder, Redactor, Academy
from lobster_academy.types import RecordEvent

# 录制行为
recorder = Recorder(agent_id="my-agent")
recorder.record(RecordEvent(
    type="inference",
    input="用户请求",
    output="Agent响应"
))

# 安全评估
academy = Academy(events=recorder.get_events())
result = academy.evaluate()
print(f"等级: {result.grade}, 总分: {result.total_score}")

# 智能脱敏
redactor = Redactor()
safe_text = redactor.redact_string("用户邮箱: test@example.com")
# 输出: "用户邮箱: [REDACTED]"
```

### 对抗性测试

```python
from lobster_academy import AdversarialEngine
from lobster_academy.attack_scenarios import BUILTIN_SCENARIOS

engine = AdversarialEngine()

# 使用内置 53 种攻击场景测试你的 Agent
def my_agent_handler(prompt: str) -> str:
    # 你的 Agent 逻辑
    return "处理完成"

results = engine.run_all(my_agent_handler)
print(f"防御率: {results.defense_rate}%")
```

---

## 🔌 框架集成 / Framework Integrations

| 框架 | 集成方式 | 说明 |
|------|---------|------|
| **OpenClaw** | Plugin | 自动拦截 LLM 调用和工具调用 |
| **LangChain** | Callback handler | 一行代码接入 |
| **CrewAI** | Crew wrapper | 自动录制 Crew 执行过程 |
| **任意框架** | Middleware | `createMiddleware()` 适配 |

---

## 📊 技术指标 / Statistics

| 指标 | 数值 |
|------|------|
| SDK 语言 | TypeScript + Python |
| 脱敏模式 | 200+（覆盖 24 国 PII） |
| 攻击场景 | 53 种（7 大类） |
| 评测维度 | 5 维度 25 指标 |
| 测试通过率 | 93%（566 tests passing） |
| 存储适配器 | In-Memory, PostgreSQL, Supabase, S3 |
| 签名算法 | Ed25519 |

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────┐
│                  Lobster Academy                     │
├─────────────┬─────────────┬─────────────────────────┤
│  Recorder   │  Redactor   │     Academy             │
│  行为录制    │  200+脱敏   │  5维25指标评测          │
├─────────────┼─────────────┼─────────────────────────┤
│  Adversarial│   Signer    │     Monitor             │
│  53种攻击   │  Ed25519    │  持续监控+预警          │
├─────────────┼─────────────┼─────────────────────────┤
│  Passport   │  Reporter   │     Compliance          │
│  Agent护照  │  报告生成   │  EU AI Act / SOC2       │
├─────────────┴─────────────┴─────────────────────────┤
│              Storage Adapters                        │
│    Memory │ PostgreSQL │ Supabase │ S3              │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 适用场景

| 场景 | 说明 |
|------|------|
| **企业 AI 团队** | 在 Agent 上线前进行安全评估 |
| **安全团队** | 对内部 Agent 进行红队测试 |
| **合规团队** | 生成审计所需的评估报告 |
| **Agent 开发者** | 在 CI/CD 中集成安全测试 |
| **第三方审计** | 提供标准化评估工具 |

---

## 📚 文档

- [快速开始](docs/quickstart.md)
- [API 参考](docs/api-reference.md)
- [安全指南](docs/security.md)
- [审计报告](AUDIT-REPORT.md)
- [商业分析](CURRENT-ANALYSIS.md)

---

## 🛣️ 路线图

| 阶段 | 时间 | 目标 |
|------|------|------|
| **Phase 1** | 当前 | 开源评估框架，建立技术信用 |
| **Phase 2** | 2026 Q3 | 付费企业版 + 标杆客户 |
| **Phase 3** | 2026 Q4 | 与认证机构合作 |
| **Phase 4** | 2027+ | 生态建设（保险/采购集成） |

---

## 🏢 Use Cases / 适用场景

- **AI Startups** — Prove your agent is safe before shipping
- **Enterprise Security Teams** — Evaluate internal AI agents
- **Compliance Officers** — Generate EU AI Act / SOC2 audit reports
- **Insurance Companies** — Assess AI liability risks

---

## 💬 Community / 社区

- [Discord](#) — Join our community
- [Twitter/X](#) — Follow for updates
- [Blog](#) — Security research & tutorials

---

## 📄 许可证 / License

本项目使用 [Apache License 2.0](LICENSE) 许可证。

This project is licensed under the [Apache License 2.0](LICENSE) — Free for commercial and personal use.

<div align="center">

**[文档 / Docs](docs/)** •
**[GitHub](https://github.com/jiach72-oss/lobster-academy)**

</div>

---

<p align="center">
  <a href="https://github.com/jiach72-oss/lobster-academy">
    <img src="https://api.star-history.com/svg?repos=jiach72-oss/lobster-academy&type=Date" alt="Star History Chart" width="600">
  </a>
</p>

<p align="center">
  Made with 🦞 by the Lobster Academy team
</p>
