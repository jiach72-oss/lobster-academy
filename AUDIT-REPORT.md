# Lobster Academy 审计报告

审计时间: 2026-03-25 13:00 GMT+8

## 总体评分: 7.2/10

项目架构设计优秀，代码质量整体良好，模块划分清晰。但存在若干运行时阻塞性 Bug 和安全改进空间。

## 各模块评分

| 模块 | 评分 | 状态 |
|------|------|------|
| Python SDK | 7.5/10 | ⚠️ |
| TypeScript SDK | 8.0/10 | ✅ |
| Dashboard | 7.5/10 | ✅ |
| 框架集成 (LangChain/LlamaIndex) | 7.0/10 | ✅ |
| 攻击场景库 | 7.0/10 | ⚠️ |
| 国际化模式 | 8.0/10 | ⚠️ |
| 存储适配器 | 6.5/10 | ⚠️ |

---

## 发现的问题 (按严重性排列)

### 🔴 严重 (必须修复)

**1. `attack_scenarios.py` 导入错误 — 模块完全不可用**
- 文件: `python-sdk/src/lobster_academy/attack_scenarios.py`
- 问题: `from .adversarial import AttackScenario` — 但 `adversarial.py` 中没有定义 `AttackScenario` 类（只在 TypeScript SDK 的 `adversarial-engine.ts` 中定义了同名接口）
- 影响: `from lobster_academy.attack_scenarios import BUILTIN_SCENARIOS` 必定失败，53个内置攻击场景完全不可用
- 修复: 需要在 `adversarial.py` 中定义 `AttackScenario` dataclass，或重写 `attack_scenarios.py` 使用独立的类定义

**2. 存储适配器测试全部失败 — mock 路径错误**
- 文件: `python-sdk/tests/test_storage_adapters.py`
- 问题: 17个存储适配器测试全部 FAILED，错误为 `AttributeError: module does not have the attribute 'redis'` 等。mock 路径 `lobster_academy.storage.redis_adapter.redis` 不正确 — 适配器中 `import redis` 是在方法内 `try/except` 中执行的，不是模块级导入
- 影响: Elasticsearch/ClickHouse/S3/Redis 四个适配器的测试套件完全不可验证
- 修复: 修改 mock 路径，将 `patch('lobster_academy.storage.redis_adapter.redis')` 改为 `patch('redis.Redis')` 等

**3. ClickHouse/Redis/S3/Elasticsearch 适配器的 SQL 注入风险**
- 文件: `python-sdk/src/lobster_academy/storage/clickhouse_adapter.py`
- 问题: 使用 f-string 拼接 SQL: `f"SELECT * FROM {self._database}.{self._table} WHERE agent_id = %(agent_id)s"` — `self._database` 和 `self._table` 在构造函数中直接使用用户输入，无验证
- 影响: 如果攻击者控制 `database` 或 `table` 参数，可能注入恶意 SQL
- 修复: 对数据库名/表名进行白名单验证或参数化

### 🟡 中等 (建议修复)

**4. Python SDK Redactor 正则表达式误报率高**
- 文件: `python-sdk/src/lobster_academy/redactor.py`
- 问题: 
  - `hubspot` 模式 `(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})` 会匹配所有 UUID，导致任何 UUID 都被脱敏
  - SSN 模式 `\b\d{3}[\s\-]?\d{2}[\s\-]?\d{4}\b` 过于宽松，会匹配大量非 SSN 数字序列
  - 信用卡通用模式 `\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b` 几乎匹配任何16位数字
- 影响: 过度脱敏导致数据可用性降低
- 修复: 添加上下文约束（如前缀关键词检查），或使用 Luhn 校验等

**5. Python `redact_object` 未使用 i18n 模式**
- 文件: `python-sdk/src/lobster_academy/redactor.py`
- 问题: `redact_object` 方法只调用 `redact_string`（基础模式），不调用 `redact_with_locale`。测试 `TestRedactObjectI18n::test_dict_with_locale` 因此失败
- 影响: `redact_object` 无法识别 CPF 等非英文 PII
- 修复: `redact_object` 中对字符串值调用 `auto_detect_and_redact` 或提供 locale 参数

**6. TypeScript Redactor 假阳性模式 — `domain` 和 `ipv4`**
- 文件: `sdk/src/redactor.ts`
- 问题: `domain` 和 `ipv4` 模式为低置信度但默认启用。`domain` 会匹配几乎所有包含点号的文本，`ipv4` 会匹配版本号等
- 影响: 批量脱敏时数据过度污染
- 修复: 建议将 `domain`、`ipv4`、`datetime-iso` 等从默认启用列表移除

**7. LangChain 集成中 `on_chain_end` 事件类型名不一致**
- 文件: `integrations/langchain/src/lobster_academy_langchain/callback.py`
- 问题: `on_chain_start` 使用 `event_type="chainStart"` (camelCase)，但 `on_chain_end` 使用 `"chainEnd"` — 风格一致但与 Python SDK 的 snake_case 惯例不同
- 影响: 事件消费者需要处理两种命名风格
- 建议: 统一为一种命名风格（建议 Python 用 snake_case，TS 用 camelCase）

**8. LangChain 集成依赖 stub 类缺少关键方法**
- 文件: `integrations/langchain/src/lobster_academy_langchain/callback.py`
- 问题: Fallback `Storage` stub 只有 `record` 方法，但没有 `get_records` 等查询方法
- 影响: 无核心包时无法回放事件
- 建议: stub 类至少实现查询接口

### 🟢 轻微 (可选优化)

**9. Python SDK `academy.py` 中幻觉检测启发式不准确**
- 文件: `python-sdk/src/lobster_academy/academy.py`
- 问题: `_detected_hallucination` 将 "as an ai", "i cannot" 等表述标记为幻觉 — 这些是 AI 的正常安全回复
- 影响: 安全拒答会被误判为幻觉
- 建议: 改为检测事实性错误模式（如"根据我的训练数据"后跟具体事实声明）

**10. Python SDK `Recorder.get_events()` 返回的是副本引用而非深拷贝**
- 文件: `python-sdk/src/lobster_academy/recorder.py`
- 问题: `MemoryStorage.get_events()` 使用 `list()` 浅拷贝，但 RecordEvent 内部的 tool_calls 列表仍是引用
- 影响: 外部修改返回的 event 对象的 tool_calls 可能影响内部状态
- 建议: 使用 `copy.deepcopy` 或不可变数据结构

**11. TypeScript SDK `AdversarialEngine` 中 `classifyBehavior` 顺序有误**
- 文件: `sdk/src/adversarial-engine.ts`
- 问题: 先检查 `REJECTED_PATTERNS`，再检查 `BLOCKED_PATTERNS`。但许多安全拒答会同时匹配两者
- 影响: 分类结果可能不准确（拒绝 vs 阻止）
- 建议: 按更具体的模式优先

**12. Dashboard 组件硬编码 mock 数据**
- 文件: `dashboard/app/page.tsx`, `dashboard/components/ScoreChart.tsx`
- 问题: 所有数据来自 `@/lib/mock-data`，无 API 调用或数据获取逻辑
- 影响: Dashboard 目前仅为静态展示
- 建议: 添加数据获取 hooks 和 API 层

**13. TypeScript Signer 的 base64 完整性检查可能有边界问题**
- 文件: `sdk/src/signer.ts`
- 问题: `normalize = (s) => s.replace(/=+$/, '')` 用于比较 base64，但如果原始签名恰好以 `=` 结尾，攻击者截断 `=` 后仍能通过验证
- 影响: 极低概率的签名伪造
- 建议: 直接比较 Buffer 而非 base64 字符串

**14. Python SDK `Redactor` 的 `_build_patterns` 方法有500+行**
- 文件: `python-sdk/src/lobster_academy/redactor.py`
- 问题: 单个方法过长，包含200+正则模式定义
- 影响: 可读性和维护性差
- 建议: 将模式分组到独立的配置文件或常量模块

**15. `patterns.json` 缺少 JSON Schema 验证**
- 文件: `patterns/i18n/patterns.json`
- 建议: 添加 JSON Schema 以确保格式一致性，防止手动编辑引入错误

---

## 测试结果汇总

### Python SDK 测试
```
总计: 90 个测试
通过: 73 个 (81.1%)
失败: 17 个 (18.9%) — 全部为存储适配器测试
```

| 测试文件 | 通过 | 失败 |
|----------|------|------|
| test_academy.py | 5/5 | 0 |
| test_adversarial.py | 5/5 | 0 |
| test_recorder.py | 8/8 | 0 |
| test_redactor.py | 8/8 | 0 |
| test_signer.py | 8/8 | 0 |
| test_storage_adapters.py | 0/17 | 17 |

### 国际化模式测试
```
总计: 68 个测试
通过: 67 个 (98.5%)
失败: 1 个 (1.5%) — TestRedactObjectI18n::test_dict_with_locale
```

### YAML 攻击场景验证
```
9 个场景文件全部通过 YAML 语法验证
```

### TypeScript SDK 测试
```
未执行 — package.json 中 "test" 脚本引用 "ts-node tests/suite.ts"
但 ts-node 在当前环境中不可用
```

---

## 改进建议

### 短期 (1-2周)
1. **修复 `attack_scenarios.py` 导入错误** — 在 Python SDK 中定义 `AttackScenario` dataclass
2. **修复存储适配器测试 mock 路径** — 使17个失败测试通过
3. **修复 `redact_object` 不使用 i18n 模式的问题** — 补充 locale 支持
4. **ClickHouse 适配器 SQL 注入防护** — 添加表名/数据库名白名单验证

### 中期 (2-4周)
5. **降低 Redactor 误报率** — 为 Hubspot/UUID/SSN/信用卡等模式添加上下文约束
6. **统一事件类型命名规范** — Python SDK 用 snake_case，TS SDK 用 camelCase
7. **Dashboard 数据层接入** — 实现 API hooks 替换 mock 数据
8. **添加 TypeScript 集成测试** — 使用 vitest 或 jest 替代 ts-node

### 长期 (1-2个月)
9. **Redactor 模式拆分重构** — 将500行 `_build_patterns` 拆分为模块化配置
10. **添加 `patterns.json` JSON Schema** — 确保 i18n 模式格式一致性
11. **LangChain/LlamaIndex 集成完善** — stub 类补充完整接口
12. **添加端到端测试** — 验证 Python SDK ↔ TS SDK ↔ Dashboard 数据流一致性
13. **考虑引入 PII 检测的置信度评分** — Python SDK 可参考 TS SDK 的 `hasPIIWithConfidence` 实现

---

## 迭代优化计划

| 阶段 | 周期 | 目标 |
|------|------|------|
| Phase 1: 紧急修复 | 1 周 | 修复阻塞性 Bug（导入错误、测试 mock） |
| Phase 2: 质量提升 | 2 周 | 降低误报率、统一命名、补充测试 |
| Phase 3: 功能完善 | 4 周 | Dashboard 数据层、集成完善、E2E 测试 |
| Phase 4: 安全加固 | 6 周 | SQL 注入防护、签名边界修复、Schema 验证 |

---

*审计人: 太子 (AI 代码审计专家)*
*审计方法: 静态代码分析 + 测试运行 + 安全模式审查*
