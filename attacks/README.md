# MirrorAI 攻击场景库

一个全面的 AI/LLM 攻击场景集合，用于安全教育和红队测试。

## 📊 场景统计

| 分类 | 数量 | 严重等级分布 |
|------|------|-------------|
| 提示词注入 (prompt_injection) | 10 | ⭐⭐⭐⭐⭐⭐⭐⭐⭐ |
| 越狱攻击 (jailbreak) | 8 | ⭐⭐⭐⭐⭐⭐⭐⭐ |
| 数据泄露 (data_exfiltration) | 7 | ⭐⭐⭐⭐⭐⭐⭐⭐⭐ |
| 权限提升 (privilege_escalation) | 6 | ⭐⭐⭐⭐⭐⭐⭐⭐⭐ |
| 上下文操控 (context_manipulation) | 5 | ⭐⭐⭐⭐⭐⭐⭐ |
| 间接注入 (indirect_injection) | 5 | ⭐⭐⭐⭐⭐⭐⭐⭐⭐ |
| 编码绕过 (encoding_bypass) | 4 | ⭐⭐⭐⭐⭐⭐⭐ |
| 资源耗尽 (resource_exhaustion) | 4 | ⭐⭐⭐⭐⭐⭐⭐⭐⭐ |
| 社会工程 (social_engineering) | 4 | ⭐⭐⭐⭐⭐⭐⭐ |
| **总计** | **53** | - |

## 🗂️ 目录结构

```
attacks/
├── README.md              # 本文档
├── CONTRIBUTING.md        # 贡献指南
├── registry.py            # 场景注册表 (Python API)
├── validate.py            # 场景验证工具
├── updater.py             # 自动更新检查工具
├── templates/
│   └── attack_template.yaml  # 场景模板
└── scenarios/             # 场景配置文件
    ├── prompt_injection.yaml    (10 种)
    ├── jailbreak.yaml           (8 种)
    ├── data_exfiltration.yaml   (7 种)
    ├── privilege_escalation.yaml (6 种)
    ├── context_manipulation.yaml (5 种)
    ├── indirect_injection.yaml   (5 种)
    ├── encoding_bypass.yaml      (4 种)
    ├── resource_exhaustion.yaml  (4 种)
    └── social_engineering.yaml   (4 种)
```

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install pyyaml requests
```

### 2. 使用 Python API

```python
from registry import create_default_registry

# 加载场景库
registry = create_default_registry()

# 查看统计信息
stats = registry.get_statistics()
print(f"总场景数: {stats['total']}")

# 按分类获取场景
injection_scenarios = registry.get_by_category("prompt_injection")
print(f"提示词注入场景: {len(injection_scenarios)}")

# 按严重等级过滤
high_severity = registry.get_by_severity(min_severity=7)
print(f"高危场景: {len(high_severity)}")

# 搜索场景
results = registry.search("DAN")
for scenario in results:
    print(f"- {scenario.name} (严重等级: {scenario.severity})")

# 获取单个场景
scenario = registry.get("PI-001")
if scenario:
    print(f"场景: {scenario.name}")
    print(f"描述: {scenario.description}")
    print(f"攻击示例: {scenario.attack_prompt}")
    print(f"防御措施: {scenario.mitigation}")
```

### 3. 验证场景文件

```bash
# 验证单个文件
python3 validate.py scenarios/prompt_injection.yaml

# 验证整个目录
python3 validate.py scenarios/

# 详细模式
python3 validate.py -v scenarios/
```

### 4. 检查更新

```bash
# 查看当前状态
python3 updater.py status

# 检查更新
python3 updater.py check

# 执行更新
python3 updater.py update

# 初始化版本文件
python3 updater.py init
```

## ⚠️ 严重等级说明

| 等级 | 名称 | 描述 | 示例 |
|------|------|------|------|
| 1-2 | 低 🟢 | 信息泄露风险低，影响有限 | 轻微的信息泄露尝试 |
| 3-4 | 中低 🟡 | 可能导致轻微信息泄露 | 系统版本信息泄露 |
| 5-6 | 中 🟠 | 可能绕过部分安全限制 | 多语言绕过、编码混淆 |
| 7-8 | 高 🔴 | 可能导致严重安全问题 | 系统提示提取、权限绕过 |
| 9-10 | 严重 ⛔ | 可能导致系统完全失陷 | 完整越狱、数据完全泄露 |

## 🏷️ 攻击分类详解

### 提示词注入 (Prompt Injection)
通过精心构造的输入，覆盖或修改模型的系统指令。

**常见变种:**
- 直接指令覆盖
- 角色扮演注入
- 分隔符混淆
- 上下文窗口溢出

### 越狱攻击 (Jailbreak)
绕过模型的安全限制和内容策略。

**常见变种:**
- DAN 越狱
- 对立人格切换
- 假设性场景伪装
- 多步骤推理越狱

### 数据泄露 (Data Exfiltration)
提取系统配置、用户数据或训练数据中的敏感信息。

**常见变种:**
- 系统提示词提取
- API 密钥探测
- 对话历史泄露
- 工具输出数据泄露

### 权限提升 (Privilege Escalation)
获取超出授权范围的系统功能访问权限。

**常见变种:**
- 角色伪装
- 工具调用绕过
- 上下文劫持
- 链式工具调用

### 上下文操控 (Context Manipulation)
操纵对话上下文以影响模型的判断和响应。

**常见变种:**
- 对话历史篡改
- 情感操控
- 认知偏见利用
- 信任建立操控

### 间接注入 (Indirect Injection)
通过外部数据源（网页、文档、数据库）注入恶意指令。

**常见变种:**
- 网页内容注入
- 文档嵌入注入
- 数据库内容注入
- 邮件/消息注入

### 编码绕过 (Encoding Bypass)
使用各种编码技术绕过文本层面的安全检测。

**常见变种:**
- Base64 编码
- Unicode 混淆
- Hex 编码
- 多语言编码混合

### 资源耗尽 (Resource Exhaustion)
消耗系统计算资源或 API 配额。

**常见变种:**
- 无限循环生成
- Token 炸弹
- 递归工具调用
- 并发请求洪水

### 社会工程 (Social Engineering)
利用人性弱点进行攻击。

**常见变种:**
- 权威冒充
- 社会压力操控
- 学术研究伪装
- 信任累积攻击

## 🛠️ 开发工具

### registry.py

```python
# 场景注册表 API
registry = ScenarioRegistry(scenarios_dir="scenarios")

# 注册新场景
registry.register(AttackScenario(
    id="XX-001",
    name="新攻击场景",
    category="prompt_injection",
    severity=5,
    description="...",
    attack_prompt="...",
    expected_behavior="...",
    mitigation="...",
    references=["https://..."]
))

# 导出
registry.export_to_json("output.json")
registry.export_to_yaml("output.yaml")
```

### validate.py

验证场景文件格式和内容：

```bash
python3 validate.py <file_or_directory> [-v]
```

检查项：
- 必需字段完整性
- ID 格式正确性
- 分类有效性
- 严重等级范围
- 参考链接格式
- 版本号格式

### updater.py

自动更新检查：

```bash
# 检查更新
python3 updater.py check -d scenarios -r https://remote-repo

# 下载更新
python3 updater.py update -d scenarios

# 强制更新所有文件
python3 updater.py update -d scenarios --force

# 仅检查不下载
python3 updater.py update -d scenarios --dry-run
```

## 📝 贡献指南

请参阅 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何贡献新的攻击场景。

### 快速贡献步骤

1. 复制模板: `cp templates/attack_template.yaml templates/my_attack.yaml`
2. 填写场景详情
3. 运行验证: `python3 validate.py templates/my_attack.yaml`
4. 提交 Pull Request

### GitHub Issue 模板

也可以通过 [GitHub Issue](/.github/ISSUE_TEMPLATE/attack_scenario.md) 提交场景建议。

## 🔄 自动更新

场景库支持从远程仓库自动更新：

```bash
# 初始化版本跟踪
python3 updater.py init

# 检查更新
python3 updater.py check

# 执行更新
python3 updater.py update
```

版本信息存储在 `.version` 文件中，包含每个场景文件的 MD5 哈希用于增量更新。

## 📚 参考资料

- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Prompt Injection Attacks and Defenses](https://arxiv.org/abs/2302.12173)
- [Jailbreaking ChatGPT via Prompt Engineering](https://arxiv.org/abs/2305.13727)
- [Not what you've signed up for: Compromising Real-World LLM-Integrated Applications](https://arxiv.org/abs/2302.12173)

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](../LICENSE) 文件。

## 🙏 致谢

感谢所有贡献者帮助完善这个攻击场景库，提高 AI 系统的安全性。

---

**⚠️ 免责声明**: 本场景库仅用于安全教育和研究目的。请负责任地使用这些信息，不要用于任何非法或有害的活动。
