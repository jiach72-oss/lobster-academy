# 龙虾学院 · 第17轮迭代：技术选型深度分析

> 迭代时间：2026-03-24 00:51
> 迭代角度：技术实现路径

## 核心决策：用什么语言/框架

### SDK主语言

| 选项 | 优势 | 劣势 | 决策 |
|------|------|------|------|
| TypeScript | npm生态最大，前端开发者多，Agent框架多用TS | 运行时性能一般 | ✅ **首选** |
| Python | AI/ML生态最强 | pip打包体验差，CLI不如TS | 备选 |
| Go | 性能好，单二进制 | Agent框架少用Go | CLI工具用 |
| Rust | 性能最好 | 开发速度慢 | 未来优化用 |

**决策：TypeScript主SDK + Go CLI工具 + Python评测引擎**

### 为什么这样分

```
lobster-blackbox (npm包) → TypeScript
  ↓ 录制Agent行为
  ↓ 脱敏+签名
  ↓ 生成报告

lobster (CLI工具) → Go
  ↓ 配置检查
  ↓ 快速扫描
  ↓ 终端美化输出

lobster-eval (评测引擎) → Python
  ↓ 动态测试用例
  ↓ 攻击模拟
  ↓ 评分计算
```

### 框架选型

| 组件 | 选型 | 理由 |
|------|------|------|
| TS运行时 | Node.js 22+ | LTS版本，稳定 |
| TS框架 | 无（轻量库） | SDK不需要框架 |
| Go CLI | Cobra | 行业标准CLI框架 |
| Go终端 | Bubble Tea | 美观的TUI |
| Python评测 | pytest + 自定义 | 测试框架最适合做评测 |
| 签名 | tweetnacl (TS) | Ed25519纯JS实现，零依赖 |
| PDF生成 | Puppeteer (TS) | HTML转PDF，样式灵活 |
| 数据库 | PostgreSQL | 关系数据+JSON字段 |
| 缓存 | Redis | 会话+限流 |
| 消息队列 | NATS | 轻量，Agent场景适合 |

### 架构图

```
┌─────────────────────────────────────────────────┐
│                 用户的Agent代码                    │
│           (OpenAI / LangChain / 自定义)           │
└───────────────┬─────────────────────────────────┘
                │ npm install lobster-blackbox
                ▼
┌─────────────────────────────────────────────────┐
│              Lobster Blackbox SDK               │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │ Recorder │ │ Redactor │ │ Signer           ││
│  │ (录制器)  │ │ (脱敏器)  │ │ (Ed25519签名)    ││
│  └──────────┘ └──────────┘ └──────────────────┘│
│  ┌──────────┐ ┌──────────────────────────────┐ │
│  │ Reporter │ │ Plugins (OpenAI/LangChain/..) │ │
│  │ (报告器)  │ │ (框架适配插件)                  │ │
│  └──────────┘ └──────────────────────────────┘ │
└───────────────┬─────────────────────────────────┘
                │ 可选：上传到云端
                ▼
┌─────────────────────────────────────────────────┐
│              Lobster Cloud (Phase 2)            │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │ API      │ │ 存储     │ │ 评测引擎          ││
│  │ Gateway  │ │ (PG+Redis│ │ (Python)         ││
│  │          │ │  +S3)    │ │                  ││
│  └──────────┘ └──────────┘ └──────────────────┘│
└─────────────────────────────────────────────────┘
```

### 依赖管理原则

1. **最小依赖**：SDK核心零外部依赖（除了签名库）
2. **插件化**：框架适配作为可选依赖
3. **Tree-shakeable**：用户只打包需要的部分
4. **TypeScript strict**：完整类型安全

### 包结构

```
@lobster-academy/
├── blackbox          # 核心SDK
├── blackbox-openai   # OpenAI插件
├── blackbox-langchain# LangChain插件
├── blackbox-crewai   # CrewAI插件
├── blackbox-cli      # CLI工具(薄壳，调用Go)
└── blackbox-types    # 共享类型定义
```

### 发布策略

| 包 | 平台 | 版本 |
|------|------|------|
| @lobster-academy/blackbox | npm | v0.1.0 |
| lobster-cli | GitHub Releases | v0.1.0 |
| lobster-eval | pip | v0.1.0 |

---
