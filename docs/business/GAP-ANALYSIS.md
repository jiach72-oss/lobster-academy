# 龙虾学院 Blackbox — PRD 功能缺口分析

> 审计时间：2026-03-24 12:18
> 对比基准：iteration-07-sdk-design.md (PRD) + iteration-13-eval-standard.md (评测标准)

## 🔴 P0：核心功能缺口

| # | PRD功能 | 状态 | 影响 |
|---|--------|------|------|
| 1 | Anthropic/Claude 插件 | ❌ 缺失 | 覆盖不到第二大AI框架用户 |
| 2 | 报告format: 'html' | ❌ 缺失 | 用户无法获得可展示的报告文件 |
| 3 | CLI支持评测指定Agent目录 | 🟡 部分 | 当前CLI只能自检，不能评测用户的Agent |

## 🟡 P1：实现与PRD不一致

| # | PRD要求 | 实际实现 | 需要调整 |
|---|--------|---------|---------|
| 4 | generateReport参数含`period`, `format`, `include` | 仅有 `{from?, to?}` | 补充format和include |
| 5 | 独立signReport()方法 | 签名内嵌于generateReport() | 保持现有（已足够） |
| 6 | hash含`sha256:`前缀 | 纯hex无前缀 | 保持现有（合理） |
| 7 | mode: 'cloud' 云端模式 | 仅local | 类型已定义，暂无需实现 |
| 8 | 异常检测含`unusual_tool` + `pii_leak` | 仅`high_latency` + `error_spike` | 补充检测逻辑 |

## 🟢 P2：增强项

| # | 功能 | 说明 |
|---|------|------|
| 9 | 评测用例库（50+个） | 迭代13提及但未构建 |
| 10 | 推理深度评分 | 可解释性5.3要求置信度标注 |
| 11 | 数据保留策略配置 | 合规4.3要求 |

## ✅ 已正确实现

| 功能 | 验证 |
|------|------|
| 录制引擎（Recorder） | ✅ 输入校验/大小限制/深拷贝/清理机制 |
| 脱敏引擎（Redactor） | ✅ 7种内置模式+自定义正则+深度对象脱敏 |
| 签名引擎（Signer） | ✅ Ed25519/round-trip验证/密钥校验 |
| 报告生成（Reporter） | ✅ 汇总统计/异常检测/签名防篡改 |
| OpenAI插件 | ✅ 自动拦截chat.completions.create |
| LangChain插件 | ✅ 回调处理器（LLM/Chain/Tool） |
| CrewAI插件 | ✅ Agent事件拦截 |
| 自定义适配器 | ✅ AgentAdapter + wrapAgentFunction |
| CLI体检（25项） | ✅ 5维度评测/JSON输出/评分公式 |
| 防DoS（maxRecords/maxInputSize） | ✅ |
| 深拷贝保护 | ✅ |
| 内存泄漏防护（LangChain） | ✅ |
