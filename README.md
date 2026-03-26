<div align="center">

# 🦞 Lobster Academy

**AI Agent 培训与评测平台 / AI Agent Training & Evaluation Platform**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![Tests](https://img.shields.io/badge/Tests-352_passing-brightgreen.svg)]()

[中文文档](#-龙虾学院是什么) • [English](#what-is-lobster-academy) • [快速开始](#-快速开始--quick-start) • [API](docs/api-reference.md)

</div>

---

## 🇨🇳 龙虾学院是什么

Lobster Academy 是一个**开源的 AI Agent 培训与评测平台**——让你的 Agent 入学、学习安全技能、通过考核、获得认证。**每只龙虾都该经过系统的培训。**

## 🇺🇸 What is Lobster Academy

Lobster Academy is an **open-source AI Agent training and evaluation platform** — enroll your Agent, teach it security skills, test its abilities, and certify it. **Every lobster deserves proper training.**

---

## ✨ 核心功能 / Core Features

| 功能 | 说明 |
|------|------|
| 📹 行为录制 / Behavior Recording | 记录 Agent 每次决策和工具调用 |
| 🔒 智能脱敏 / Smart Redaction | 自动检测并脱敏 200+ 种敏感数据模式，覆盖 24 个国家 |
| 🎯 标准化评测 / Standardized Evaluation | 5 维度 25 项指标综合评测，输出等级和分数 |
| 🛡️ 对抗性测试 / Adversarial Testing | 53 种攻击场景实战测试，输出防御率 |
| 📡 持续监控 / Continuous Monitoring | 性能退化和异常行为自动预警 |
| 📜 数字签名 / Digital Signature | Ed25519 签名，防篡改认证 |

---

## 🚀 快速开始 / Quick Start

**CLI:**
```bash
npm install -g lobster-academy
lobster enroll --agent my-agent --department general
lobster check --agent my-agent
```

**SDK (Python):**
```python
from lobster_academy import Recorder, Redactor, Academy

recorder = Recorder(agent_id="my-agent")
recorder.record(type="decision", input={"msg": "hello"}, output={"response": "done"})
result = Academy(agent_id="my-agent").evaluate()
```

---

## 🔌 框架集成 / Framework Integrations

| 框架 | 方式 |
|------|------|
| **OpenClaw** | 自动拦截 LLM 调用和工具调用 |
| **LangChain** | Callback handler 自动录制 |
| **CrewAI** | Crew 包装器自动录制 |
| **通用中间件** | `createMiddleware()` 适配任何框架 |

---

## 📊 统计 / Statistics

| 指标 | 数值 |
|------|------|
| SDK 语言 | TypeScript + Python |
| 脱敏模式 | 200+ |
| 攻击场景 | 53 |
| 评测指标 | 25 |
| 测试用例 | 352 |
| 国际化国家 | 24 |
| 存储适配器 | In-Memory, PostgreSQL, Supabase |

---

## 📄 许可证 / License

本项目使用 [Apache License 2.0](LICENSE) 许可证。

This project is licensed under the [Apache License 2.0](LICENSE).

<div align="center">

**[文档 / Docs](docs/)** •
**[GitHub](https://github.com/jiach72-oss/lobster-academy)**

Made with 🦞 by Lobster Academy Team

</div>
