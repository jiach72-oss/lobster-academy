# 📋 更新日志 / Changelog

所有重要的项目变更都会记录在此文件中。
All notable changes to this project will be documented in this file.

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.2.0] - 2026-03-26

### Added
- **CLI 工具** `lobster` — 7个命令（enroll/check/record/report/status/certificate/verify）
- **P0 算法** — Aho-Corasick 多模式匹配、分层响应分析、Merkle 哈希链、贝叶斯评分、报告生成、密钥管理、分层存储
- **P1 算法** — Bloom Filter、Fuzzing 变异引擎、异步批量写入、百分位基准对标、智能摘要、Merkle 批量签名、统一查询路由
- **P2 算法** — i18n 缓存、对抗性迭代循环、分页查询、入学/毕业流程、密钥撤销、一致性哈希分区
- **框架集成插件** — OpenClaw、CrewAI、LangChain（增强）、通用中间件接口
- **Agent 护照系统** — 指纹算法、变更检测、复测建议
- **持续监控** — 6种检测算法 + 自动复测触发
- **合规报告** — EU AI Act + SOC2 双标准
- **npm/pip 发布配置** — package.json + .npmignore + pyproject.toml + publish.sh
- 352 项单元测试全部通过

### Fixed
- 正则 flags='g' 全局状态污染
- 评分逻辑二极管（0或100）
- MemoryAdapter offset/limit 逻辑错误
- 主密钥明文驻留内存
- TrendTracker 排序 bug
- bySeverity 索引错位
- priorityTemplates 语义错配
- Hot 层查询被跳过
- 深度超限返回值类型不安全
- 配置文件权限过宽
- CLI 堆栈信息泄露

---

## [0.2.0] - 2026-03-25

### 🎉 双语言 SDK + Dashboard + 国际化 / Dual-Language SDK + Dashboard + i18n

#### ✨ 新增功能 / New Features

**Python SDK / Python 开发套件：**
- `Recorder` — Agent 行为录制模块（Python 版）/ Agent behavior recording module (Python)
- `Redactor` — 200+ 种敏感数据脱敏模式（Python 版）/ 200+ sensitive data redaction patterns (Python)
- `Academy` — 5 维度 25 项标准化评测引擎（Python 版）/ 5-dimension 25-metric evaluation engine (Python)
- `AdversarialEngine` — 53 种攻击场景对抗测试（Python 版）/ 53 attack scenario adversarial testing (Python)
- `Signer` — Ed25519 数字签名验证（Python 版）/ Ed25519 digital signature verification (Python)
- 完整的 Python 测试套件（125 个测试用例）/ Complete Python test suite (125 test cases)

**国际化支持 / Internationalization (i18n)：**
- 支持 24 个国家/地区的敏感数据模式 / 24 country/region sensitive data patterns
- 亚太：中国、日本、韩国、印度、澳大利亚、新加坡 / APAC: CN, JP, KR, IN, AU, SG
- 欧洲：英国、法国、德国、意大利、西班牙、荷兰、瑞典、瑞士 / EU: UK, FR, DE, IT, ES, NL, SE, CH
- 北美：美国、加拿大 / NA: US, CA
- 南美：巴西、阿根廷、墨西哥、哥伦比亚 / SA: BR, AR, MX, CO
- 其他：俄罗斯、南非、以色列、阿联酋 / Other: RU, ZA, IL, AE
- `I18nRedactor` — 多国敏感数据自动检测和脱敏 / Multi-country auto-detection and redaction
- `CountryPatterns` — 国家模式数据库 / Country pattern database
- i18n 测试套件（68 个测试用例）/ i18n test suite (68 test cases)
- 前端国际化资源（中文、英文）/ Frontend i18n resources (Chinese, English)

**Web Dashboard / 管理界面：**
- 基于 Next.js 的全功能 Web Dashboard / Full-featured Next.js Web Dashboard
- 行为监控页面 — 实时查看 Agent 决策记录 / Behavior Monitoring — real-time Agent decision logs
- 评测报告页面 — 可视化 5 维度评测结果 / Evaluation Reports — visualized 5-dimension results
- 安全审计页面 — 攻击测试结果和防御率 / Security Audit — attack test results and defense rates
- 课程管理页面 — Agent 培训课程管理 / Course Management — Agent training course management
- 技能图谱页面 — Agent 能力评估图谱 / Skill Map — Agent capability assessment map
- 护照系统 — Agent 能力护照和技能验证 / Passport System — Agent capability passport
- 排行榜 — Agent 能力排名和对比 / Ranking — Agent capability ranking and comparison
- 证书验证 — Ed25519 签名证书在线验证 / Certificate Verification — online signature verification
- 用户认证系统（登录/注册）/ User authentication system (login/register)

**框架集成 / Framework Integrations：**
- `LangChainRecorder` — LangChain AgentExecutor 自动录制 / LangChain AgentExecutor auto-recording
- `LlamaIndexRecorder` — LlamaIndex 查询引擎自动录制 / LlamaIndex query engine auto-recording
- 支持同步和异步调用 / Supports sync and async calls
- 零代码侵入（装饰器/包装器模式）/ Zero code intrusion (decorator/wrapper pattern)

**存储适配器 / Storage Adapters：**
- `SupabaseStorage` — Supabase 云存储适配器 / Supabase cloud storage adapter
- 扩展的 `StorageAdapter` 接口 / Extended `StorageAdapter` interface
- 自定义存储适配器文档 / Custom storage adapter documentation

**AI 平台插件 / AI Platform Plugins：**
- `OpenAI` 插件 / OpenAI plugin
- `Anthropic` 插件 / Anthropic plugin
- `CrewAI` 插件 / CrewAI plugin

#### 📊 测试更新 / Test Updates

- TypeScript 测试：68 个 / TypeScript tests: 68
- Python SDK 测试：125 个 / Python SDK tests: 125
- YAML 配置测试：53 个 / YAML config tests: 53
- 总计：352 个测试用例（全部通过）/ Total: 352 test cases (all passing)

#### 🔧 改进 / Improvements

- 完善项目结构，新增 python-sdk/、patterns/i18n/、public/locales/ 目录
- 完善项目结构，新增 python-sdk/、patterns/i18n/、public/locales/ 目录
- 新增 i18n 模式数据库和测试 / New i18n pattern database and tests
- 新增 React 组件（ErrorBoundary, LanguageSwitcher）/ New React components
- 新增认证和速率限制中间件 / New authentication and rate-limiting middleware
- 新增模拟数据服务 / New mock data service

---

## [未发布 / Unreleased]

### 计划中 / Planned
- 更多脱敏模式（医疗、教育领域）/ More redaction patterns (medical, education)
- 更多存储后端（Redis、MongoDB）/ More storage backends (Redis, MongoDB)
- 可视化评测报告导出 / Visual evaluation report export
- 实时协作编辑 / Real-time collaborative editing

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

- [GitHub Releases](https://github.com/jiach72-oss/lobster-academy/releases)
- [npm](https://www.npmjs.com/package/lobster-academy)
- [文档 / Documentation](docs/)
