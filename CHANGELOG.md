# 📋 更新日志 / Changelog

所有重要的项目变更都会记录在此文件中。
All notable changes to this project will be documented in this file.

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [未发布 / Unreleased]

### 计划中 / Planned
- Python SDK
- 更多脱敏模式（医疗、教育领域）/ More redaction patterns (medical, education)
- Web Dashboard 界面 / Web Dashboard interface
- 更多存储后端（Redis、MongoDB）/ More storage backends (Redis, MongoDB)

---

## [0.1.0] - 2026-03-25

### 🎉 首次发布 / First Release

#### ✨ 新增功能 / New Features

**核心 SDK / Core SDK：**
- `Recorder` — Agent 行为录制模块 / Agent behavior recording module
- `Redactor` — 200+ 种敏感数据脱敏模式 / 200+ sensitive data redaction patterns
- `Academy` — 5 维度 25 项标准化评测引擎 / 5-dimension 25-metric evaluation engine
- `AdversarialEngine` — 53 种攻击场景对抗测试 / 53 attack scenario adversarial testing
- `Signer` — Ed25519 数字签名验证 / Ed25519 digital signature verification

**脱敏能力 / Redaction Capabilities：**
- 个人信息 / PII：身份证、护照、SSN、驾照等 60+ 种 / ID Card, Passport, SSN, Driver License etc. 60+ types
- 密钥凭证 / Credentials：AWS、GCP、Azure、GitHub 等 70+ 种 / AWS, GCP, Azure, GitHub etc. 70+ types
- 网络数据 / Network：IP、域名、连接字符串等 30+ 种 / IP, Domain, Connection String etc. 30+ types
- 金融数据 / Financial：信用卡、IBAN、支付宝等 25+ 种 / Credit Card, IBAN, Alipay etc. 25+ types
- 医疗数据 / Medical：ICD-10、处方号等 10+ 种 / ICD-10, Prescription Number etc. 10+ types
- 其他敏感数据 / Other：UUID、JWT、密钥文件等 15+ 种 / UUID, JWT, Key Files etc. 15+ types

**评测维度 / Evaluation Dimensions：**
1. 安全性（Security）— 提示注入防御、权限边界、数据保护 / Prompt injection defense, permission boundaries, data protection
2. 推理能力（Reasoning）— 多步规划、指令遵循、上下文稳定性 / Multi-step planning, instruction following, context stability
3. 工具使用（Tooling）— 调用准确性、参数校验、编排能力 / Call accuracy, parameter validation, orchestration
4. 合规性（Compliance）— 审计日志、资源效率、标准化 / Audit logs, resource efficiency, standardization
5. 稳定性（Stability）— 错误恢复、长对话一致性 / Error recovery, long conversation consistency

**攻击场景 / Attack Scenarios：**
- 提示注入 / Prompt Injection：10 种变体 / 10 variants
- 权限提升 / Privilege Escalation：8 种变体 / 8 variants
- 数据泄露 / Data Leakage：9 种变体 / 9 variants
- 拒绝服务 / Denial of Service：8 种变体 / 8 variants
- 逻辑绕过 / Logic Bypass：9 种变体 / 9 variants
- 多轮攻击 / Multi-turn Attacks：9 种变体 / 9 variants

**存储层 / Storage Layer：**
- `InMemoryStorage` — 内存存储（开发环境）/ In-memory storage (development)
- `PgStorage` — PostgreSQL 存储（生产环境）/ PostgreSQL storage (production)
- 可扩展的 `StorageAdapter` 接口 / Extensible `StorageAdapter` interface

**CLI 工具 / CLI Tools：**
- `lobster check` — 运行自检 / Run self-check
- `lobster report` — 生成报告 / Generate report

#### 🔒 安全特性 / Security Features

- 密码 PBKDF2 哈希（100,000 迭代）/ Password PBKDF2 hashing (100,000 iterations)
- 时序安全密码验证 / Timing-safe password verification
- CSRF 保护 / CSRF protection
- 速率限制 / Rate limiting
- 安全响应头（CSP、HSTS、X-Frame-Options）/ Security response headers
- 输入消毒 / Input sanitization

#### 📊 统计 / Statistics

- 代码行数 / Lines of Code：4,000+
- 测试用例 / Test Cases：567（全部通过 / all passing）
- 脱敏模式 / Redaction Patterns：200+
- 攻击场景 / Attack Scenarios：53
- 评测指标 / Evaluation Metrics：25

#### 📦 依赖 / Dependencies

- TypeScript 5.7
- Node.js 20+
- tweetnacl（Ed25519 签名 / Ed25519 signature）
- Drizzle ORM（PostgreSQL）
- pg（数据库连接 / database connection）

---

## 版本说明 / Version Guide

- **主版本号 / Major**：不兼容的 API 变更 / Incompatible API changes
- **次版本号 / Minor**：向下兼容的功能性新增 / Backward-compatible new features
- **修订号 / Patch**：向下兼容的问题修正 / Backward-compatible bug fixes

---

## 🔗 链接 / Links

- [GitHub Releases](https://github.com/lobster-academy/sdk/releases)
- [npm](https://www.npmjs.com/package/lobster-academy)
- [文档 / Documentation](https://lobster-academy.com/docs)
