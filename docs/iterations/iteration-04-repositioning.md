# 龙虾学院 · 第4轮迭代：定位重构

> 迭代时间：2026-03-24 00:10
> 迭代角度：战略定位修正

## 3轮迭代后的定位修正

### 旧定位（V2）
"企业级私有Agent的上岗资格与运行治理基础设施"

### 问题
- "上岗资格"暗示认证→法律风险
- "运行治理"太抽象→客户不知道具体买什么
- 没有切中客户真正痛点

### 新定位
**"Agent行为证据平台——让每一次Agent决策都可追溯、可审计、可证明"**

### 为什么这个定位更好

1. **切中刚需**：客户不怕Agent不够聪明，怕出事没证据
2. **避开法律风险**：不发认证，只提供证据
3. **自然付费动机**：没有证据=出事赔钱
4. **与竞品差异大**：没人做Agent行为证据的专门平台
5. **可扩展**：证据→评测→监控→保险，自然延伸

## 隐喻更新

| 旧隐喻 | 新隐喻 |
|--------|--------|
| 龙虾学院=培训+考试+发证 | 龙虾学院=Agent的黑匣子 |
| 龙虾毕业=获得证书 | 龙虾上飞机=有飞行记录仪 |
| 龙虾年检=定期复评 | 龙虾体检=定期行为审查 |

**新Slogan："每只龙虾都该有一个黑匣子"**

## MVP重新设计

### MVP名称
**Lobster Blackbox — Agent行为记录仪**

### 核心功能（3个，不多不少）

1. **行为录制**
   - Agent的每次工具调用、每次决策、每次输入输出
   - 自动脱敏（PII/密钥）
   - 签名防篡改

2. **证据报告**
   - 一键生成标准化行为审计报告
   - PDF+可验证签名
   - 时间线可视化

3. **免费体检**
   - Agent配置安全检查
   - 获客入口

### 技术实现（2周可完成）

```
npm install lobster-blackbox
```

```javascript
import { Blackbox } from 'lobster-blackbox';

const box = new Blackbox({
  agentId: 'my-agent-001',
  apiKey: 'lobster_xxx',
  redact: ['email', 'phone', 'creditCard'],
});

// 包装Agent的每个决策
const result = await box.record({
  action: 'tool_call',
  tool: 'send_email',
  input: { to: '[REDACTED]', subject: '...' },
  output: { status: 'sent' },
  reasoning: '用户要求发送确认邮件',
});

// 生成报告
const report = await box.generateReport({
  period: '2026-03',
  format: 'pdf',
});
```

### 定价（极简）
- 免费版：1000次记录/月
- Pro版：¥99/月，10万次记录/月
- 企业版：¥999/月，无限记录+审计报告+SLA

### 冷启动路径
1. 开源SDK核心（npm/pip）
2. 发到GitHub+Moltbook+Hacker News
3. 免费体检工具引流
4. 转化到付费版
5. 找3个SaaS客户做标杆案例

## 与V2的差异

| 项目 | V2 | 本轮 |
|------|-----|------|
| 定位 | 评测+认证+监控 | 行为证据平台 |
| Slogan | 上岗资格基础设施 | 每只龙虾都该有一个黑匣子 |
| MVP | CLI体检工具 | Blackbox行为记录仪 |
| 定价 | L1¥299/次 | 免费→¥99/月→¥999/月 |
| 获客 | 访谈+PLG | 开源SDK+免费工具 |

---
