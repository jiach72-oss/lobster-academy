# 明镜 Blackbox SDK — PostgreSQL 部署指南

## 概述

Lobster Blackbox SDK 支持 PostgreSQL 持久化存储，用于生产环境的数据持久化需求。同时保留内存存储作为开发/测试降级方案。

## 架构

```
┌────────────────────────────────────────────────────┐
│              LobsterBlackbox 主类                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Recorder │ │ Academy  │ │ Reporter         │   │
│  └────┬─────┘ └────┬─────┘ └────────┬─────────┘   │
│       │             │               │              │
│  ┌────▼─────────────▼───────────────▼──────────┐  │
│  │           StorageAdapter 接口                 │  │
│  └────┬─────────────────────────────┬──────────┘  │
│       │                             │              │
│  ┌────▼──────────┐    ┌────────────▼───────────┐  │
│  │ InMemoryStorage│    │     PgStorage          │  │
│  │ (开发/降级)    │    │  (Drizzle ORM + pg)    │  │
│  └───────────────┘    └────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 安装 PostgreSQL

```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql

# Docker
docker run -d --name lobster-pg \
  -e POSTGRES_USER=lobster \
  -e POSTGRES_PASSWORD=lobster123 \
  -e POSTGRES_DB=lobster_academy \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. 配置环境变量

```bash
export DATABASE_URL="postgres://lobster:lobster123@localhost:5432/lobster_academy"
```

### 3. 初始化数据库

```bash
# 创建表结构 + 填充种子数据
npm run db:migrate

# 或分步执行
npm run db:init   # 仅创建表
npm run db:seed   # 仅填充技能库（33项）
```

### 4. 在代码中使用

```typescript
import { LobsterBlackbox, createStorage } from '@lobster-academy/blackbox';

// 方式1：自动连接（推荐）
// 设置 DATABASE_URL 环境变量后，createStorage 会自动使用 PostgreSQL
const storage = await createStorage();

// 方式2：显式配置
const storage = await createStorage({
  pg: {
    connectionString: 'postgres://user:pass@localhost:5432/lobster',
    max: 20,                      // 最大连接数
    connectionTimeoutMillis: 5000, // 连接超时
    idleTimeoutMillis: 30000,     // 空闲超时
  },
});

// 方式3：强制内存存储（开发/测试）
const storage = await createStorage({ forceMemory: true });

// 方式4：优雅降级（PG不可用时自动降级到内存）
const storage = await createStorage({
  pg: { connectionString: process.env.DATABASE_URL },
  gracefulFallback: true, // 默认 true
});
```

## 数据库 Schema

### 表结构

| 表名 | 说明 | 主要字段 |
|------|------|----------|
| `users` | 用户表 | id, username, email |
| `agents` | 代理表 | agent_id, department, metadata(JSONB) |
| `recordings` | 录制记录表 | agent_id, type, input/output(JSONB), hash, signature |
| `reports` | 审计报告表 | agent_id, period, summary(JSONB), anomalies(JSONB) |
| `evaluations` | 评测记录表 | agent_id, dimensions(JSONB), total_score, grade |
| `skills` | 技能库表 | id, name, category, dimension, max_score |
| `signatures` | 签名记录表 | agent_id, record_id, signature, data_hash |

### JSONB 字段说明

- **agents.metadata**: `{ studentId, enrolledAt, advisor, initialScore, currentGrade, badges, certificates }`
- **recordings.input/output**: 脱敏后的 Agent 输入/输出数据
- **recordings.tool_calls**: 工具调用记录数组
- **reports.summary**: `{ totalDecisions, totalToolCalls, totalErrors, avgDuration, uniqueTools }`
- **evaluations.dimensions**: `{ security, reliability, observability, compliance, explainability }` 各含 `{ score, max }`

## 迁移管理

```bash
# 初始化数据库（建表）
npm run db:init

# 填充种子数据（33个默认技能）
npm run db:seed

# 一键初始化（init + seed）
npm run db:migrate

# 重置数据库（⚠️ 危险：删除所有表）
npm run db:reset
```

## 连接池配置

生产环境建议配置：

```typescript
const storage = await createStorage({
  pg: {
    connectionString: process.env.DATABASE_URL,
    max: 20,                       // 最大连接数（根据并发量调整）
    connectionTimeoutMillis: 5000,  // 连接超时 5s
    idleTimeoutMillis: 30000,      // 空闲连接回收 30s
  },
});
```

## 优雅降级

当 PostgreSQL 不可用时，SDK 自动降级到内存存储：

```typescript
// PG 连接失败 → 自动使用内存存储 + 控制台警告
const storage = await createStorage();
// ⚠️ PostgreSQL 连接失败，降级到内存存储: connect ECONNREFUSED ...

// 禁用降级（PG 必须可用）
const storage = await createStorage({
  gracefulFallback: false, // 连接失败时抛出异常
});
```

## 性能优化

1. **批量写入**: 使用 `saveRecords()` 批量插入，减少事务开销
2. **索引覆盖**: 为 agent_id、timestamp、type 建立了索引
3. **分批处理**: 大批量写入自动分 100 条/批
4. **连接池**: 通过 `max` 参数控制最大连接数

## 监控

```sql
-- 检查表大小
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;

-- 检查录制记录数量（按Agent）
SELECT agent_id, COUNT(*) as record_count
FROM recordings
GROUP BY agent_id
ORDER BY record_count DESC;

-- 检查最近的评测记录
SELECT agent_id, sequence, total_score, grade, timestamp
FROM evaluations
ORDER BY timestamp DESC
LIMIT 10;
```

## 故障排查

| 问题 | 解决方案 |
|------|----------|
| `DATABASE_URL 环境变量未设置` | 设置 `DATABASE_URL=postgres://...` |
| `connect ECONNREFUSED` | 检查 PostgreSQL 是否运行，端口是否正确 |
| `password authentication failed` | 检查用户名密码是否正确 |
| `database "xxx" does not exist` | 先创建数据库：`createdb lobster_academy` |
| `relation "xxx" does not exist` | 运行 `npm run db:init` 创建表结构 |

## 技术栈

- **ORM**: Drizzle ORM 0.39+（轻量级，TypeScript 友好）
- **驱动**: pg 8.x（Node.js PostgreSQL 驱动）
- **数据库**: PostgreSQL 14+（推荐 16）
- **连接池**: pg Pool（内置）
