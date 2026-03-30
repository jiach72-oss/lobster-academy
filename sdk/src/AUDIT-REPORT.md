# 龙虾学院 Blackbox SDK — 新增算法模块审计报告

**审计时间**: 2026-03-26  
**审计范围**: 11个新增/修改模块  
**审计维度**: 安全性、正确性、性能、兼容性

---

## 1. `redactor-v2.ts` — Aho-Corasick 脱敏引擎 v2

**评分: 8.5/10**

### 优势
- 三层分层架构设计优秀：AC快速扫描 → 正则精确验证 → 边界校验
- P0-1修复已到位：`regex.lastIndex = 0` 在所有使用 `g` flag 的正则前重置
- 内置50+常见凭证模式覆盖全面
- `_applyReplacements` 从后往前替换避免偏移问题
- MAX_INPUT_LENGTH 截断防止超长输入DoS
- 超时机制防止无限循环

### 问题清单

| 级别 | 问题 | 位置 |
|------|------|------|
| P1 | `BUILT_IN_TIERED_PATTERNS` 中 `heroku-api-key` 的 prefix 为空串，不会进入AC层，但会在无前缀模式中直接正则匹配，UUID格式误报率高 | heroku-api-key |
| P1 | `_redactObjectImpl` 对敏感键值直接替换为 `[REDACTED]`，但值本身可能包含需要保留的元信息 | L480 |
| P2 | `AhoCorasick.search` 中使用 `queue.shift()` 是O(n)，大量模式时性能可优化为数组指针 | L120 |
| P2 | `getMatches` 对无前缀模式标记tier=1，但实际上应该是AC层之外的直接匹配 | L430 |

---

## 2. `redactor-optimizer.ts` — Bloom Filter + 流式脱敏 + i18n缓存

**评分: 8.0/10**

### 优势
- BloomFilter使用双重哈希(FNV-1a + DJB2)，分布均匀
- StreamingRedactor滑动窗口设计合理，跨chunk边界处理正确
- PatternFrequencySorter使用EMA指数移动平均统计频率
- I18nPatternCache支持异步加载和预热

### 问题清单

| 级别 | 问题 | 位置 |
|------|------|------|
| P1 | `_isExactSensitiveKey` 使用 `includes` 匹配而非精确匹配，`password` 会误匹配 `password_hash` 等非敏感字段 | L530 |
| P1 | `StreamingRedactor.redactChunk` 返回空串时无法区分"无内容输出"和"内容全部在缓冲区" | L310 |
| P2 | BloomFilter的2048-bit大小对于40+敏感键，假阳性率约1%，可接受但无动态扩容 | L180 |
| P2 | `I18nPatternCache.register` 对编译失败的正则静默跳过，缺乏错误上报 | L580 |

---

## 3. `response-analyzer.ts` — 分层响应分析器

**评分: 7.5/10**

### 优势
- 4层检测机制从快到慢逐步深入
- P0-2修复已到位：加权评分替代二极管逻辑
- 严重度权重系统合理(CRITICAL=4, HIGH=3等)
- 支持同步/异步两种分析模式

### 问题清单

| 级别 | 问题 | 位置 |
|------|------|------|
| P1 | `CREDENTIAL_STRUCTURES` 最后一个正则 `[A-Za-z0-9+/=]{40,}` 会误匹配普通base64编码数据，false positive率高 | L130 |
| P1 | `evaluateAttack` 中 weightedScore 使用 `Math.max(0, Math.round((100 - penalty) * 100) / 100)`，双重round可能导致精度问题 | L230 |
| P2 | `_tier1_exactMatch` 仅做子串匹配，`password`会匹配到包含`password`的正常文本 | L310 |
| P2 | 缺少对Tier2语义检测的单元测试覆盖（依赖外部detector）

---

## 4. `fuzzing-engine.ts` — Fuzzing 变异引擎

**评分: 8.0/10**

### 优势
- 模板系统设计灵活，支持变量替换和多种变异操作
- 9种变异操作覆盖全面（同义、编码、Unicode、多语言等）
- 对抗性迭代循环实现覆盖率引导
- 分批并行执行控制并发

### 问题清单

| 级别 | 问题 | 位置 |
|------|------|------|
| P1 | `MutationEngine.synonym` 使用 `new RegExp(\`\\b${word}\\b\`, 'i')` 当word包含特殊正则字符时会出错 | L310 |
| P1 | `runAdversarialLoop` 中 `priorityTemplates` 更新逻辑有误：用 `newCoverage`（防御类型）更新 `priorityTemplates`（模板ID） | L580 |
| P2 | `MutationEngine.unicode` 使用 `Math.random()` 导致结果不可复现，不利于测试 | L340 |
| P2 | 变异操作可能生成大量变体导致内存压力，缺少变体数量上限 | L500 |

---

## 5. `async-writer.ts` — 异步批量写入器

**评分: 8.5/10**

### 优势
- RingBuffer实现正确，drain-restore模式合理
- 三种flush策略（定时/定量/手动）完整
- DeltaCompressor公共前缀压缩思路实用
- 分页查询支持页码和游标两种模式
- Graceful shutdown确保数据不丢失

### 问题清单

| 级别 | 问题 | 位置 |
|------|------|------|
| P1 | `_collectAllEvents` 使用drain-restore方式遍历缓冲区，并发flush时可能导致事件顺序错乱 | L440 |
| P1 | `DeltaCompressor.compress` 对 `__unchanged` 标记的数据，`query` 方法返回的是压缩数据而非解压数据 | L180 |
| P2 | `query` 方法中游标分页使用时间戳作为游标，同时间戳事件可能重复或遗漏 | L400 |
| P2 | 定时器`unref`只在Node.js环境有效，浏览器环境需要显式stop | L540 |

---

## 6. `merkle-chain.ts` — Merkle 哈希链

**评分: 9.0/10**

### 优势
- 链式哈希实现正确：`hash = SHA256(data_json + prev_hash)`
- `verify()` 检测篡改并标记后续事件
- Merkle Root 计算支持奇数叶子节点
- `import/export` 支持持久化
- `_serialize` 使用排序键保证确定性

### 问题清单

| 级别 | 问题 | 位置 |
|------|------|------|
| P2 | `_serialize` 使用 `Object.keys(data).sort()` 不处理嵌套对象排序，深层对象可能产生不同哈希 | L300 |
| P2 | `getMerkleRoot` 对奇数个叶子复制最后一个，与标准Merkkle树实现不同（标准做法是复制最后一个哈希） | L260 |
| P2 | 缺少种子(seed)场景的完整测试 | - |

---

## 7. `bayesian-scorer.ts` — 贝叶斯评分 + 百分位对标

**评分: 8.5/10**

### 优势
- Beta分布建模正确，先验平滑避免小样本极端评分
- 置信度公式 `1 - variance * 4` 合理映射到0-1
- 多层幻觉检测器设计有创意
- 百分位基准对标使用线性插值
- TrendTracker退化预警机制实用

### 问题清单

| 级别 | 问题 | 位置 |
|------|------|------|
| P1 | `HallucinationDetector._layer3_uncertainty` 阈值3次过于宽松，正常文本也可能触发 | L280 |
| P1 | `TrendTracker.getTrend` 中排序比较函数 `(a, b) => a[0] - a[0]` 始终为0，排序无效 | L560 |
| P2 | `scoreToPercentile` 对相同分数的处理（count += 0.5）是近似方法，精度有限 | L480 |
| P2 | `HallucinationDetector._extractEntities` 仅匹配英文大写开头和引号内容，对中文实体支持有限 | L340 |

---

## 8. `academy-flow.ts` — 入学/毕业流程

**评分: 8.0/10**

### 优势
- 完整的入学→学习→毕业生命周期
- 学号生成格式 `LS-YYYYMMDD-NNNN` 清晰
- 学习路径推荐基于维度得分率
- 学期按季度自动划分
- S级自动毕业检查

### 问题清单

| 级别 | 问题 | 位置 |
|------|------|------|
| P1 | `completeAssessment` 调用后stage变为'learning'，但缺少'assessment'中间状态的停留 | L200 |
| P1 | `_scoreToGrade` 总分范围是0-250（5维度各50），但S级阈值90/250=36%，与其他模块阈值不一致 | L450 |
| P2 | `checkGraduation` 要求3次评测但未提供跳过机制 | L330 |
| P2 | `_createSemester` 的endDate在创建时就是当前时间，不够准确 | L460 |

---

## 9. `reporter-v2.ts` — 报告生成器

**评分: 8.0/10**

### 优势
- 四种输出格式统一接口
- 智能摘要三档（brief/standard/detailed）实用
- HTML报告含完整CSS样式
- 增量差异报告功能完整
- 建议库模式匹配设计合理

### 问题清单

| 级别 | 问题 | 位置 |
|------|------|------|
| P1 | `toHTML` 中直接拼接用户数据到HTML，存在XSS风险（agentId、dimension name等未转义） | L200-250 |
| P2 | `_generateSmartSummary` 中"优秀/良好/一般/较差"判断与学院等级S/A/B/C/D映射关系不直观 | L380 |
| P2 | 自定义模板功能缺少沙箱限制，模板函数可执行任意代码 | L340 |

---

## 10. `key-manager.ts` — 密钥管理器

**评分: 8.5/10**

### 优势
- HKDF-SHA256实现符合RFC 5869
- P0-4修复已到位：派生/签名后清零种子Buffer
- Ed25519签名使用tweetnacl库
- 密钥撤销CRL + 审计日志完整
- Merkle批量签名和可信时间戳实现正确
- `destroy()` 方法清理所有密钥材料

### 问题清单

| 级别 | 问题 | 位置 |
|------|------|------|
| P1 | `signWithRevocationCheck` 先调 `isKeyRevoked` 写审计日志，再调 `sign` 又派生密钥，主密钥在内存中暴露时间延长 | L380 |
| P1 | `revokeKey` 同时调用 `revoke()` 和写入CRL，`revoke()` 已设置 `active=false`，重复操作 | L340 |
| P2 | `hkdf` 函数对 salt 默认全零，安全性略低于随机盐 | L180 |
| P2 | `_nextPeriod` 仅支持季度轮换，无法配置月度/年度 | L540 |

---

## 11. `storage/tiered-storage.ts` — 分层存储

**评分: 8.0/10**

### 优势
- Chain of Responsibility 模式实现正确
- MemoryAdapter TTL过期和cleanup机制完整
- P0-3修复已到位：先收集再分页
- ConsistentHashingRouter使用FNV-1a + 虚拟节点
- QueryRouter按时间范围智能路由

### 问题清单

| 级别 | 问题 | 位置 |
|------|------|------|
| P1 | `AutoMigrator._migrate` 中对Hot层所有到期数据逐条迁移，大量数据时性能差（应批量操作） | L580 |
| P1 | `ConsistentHashingRouter` 扩缩容时，哈希环重建但无数据迁移逻辑，数据一致性无法保证 | L680 |
| P2 | `MemoryAdapter.query` 遍历整个Map，无索引，大数据量时性能退化 | L150 |
| P2 | `TieredStorage.query` 只返回第一个有数据的适配器结果，不支持跨层合并 | L340 |

---

## 综合评分汇总

| 模块 | 评分 | 关键P1问题数 |
|------|------|-------------|
| redactor-v2.ts | 8.5 | 1 |
| redactor-optimizer.ts | 8.0 | 2 |
| response-analyzer.ts | 7.5 | 2 |
| fuzzing-engine.ts | 8.0 | 2 |
| async-writer.ts | 8.5 | 2 |
| merkle-chain.ts | 9.0 | 0 |
| bayesian-scorer.ts | 8.5 | 2 |
| academy-flow.ts | 8.0 | 2 |
| reporter-v2.ts | 8.0 | 1 |
| key-manager.ts | 8.5 | 2 |
| tiered-storage.ts | 8.0 | 2 |

**平均分: 8.18/10**  
**P0问题: 0**（所有P0已修复）  
**P1问题: 18**  
**P2问题: 22**

### 总体评价
代码质量整体优秀，架构设计合理，P0问题已全部修复。主要风险点集中在：
1. 正则误报率（response-analyzer、redactor-v2）
2. 内存安全（key-manager密钥暴露时间）
3. 并发安全（async-writer drain-restore）
4. XSS风险（reporter-v2 HTML输出）
