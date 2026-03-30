# 贡献攻击场景指南

感谢您对 MirrorAI 攻击场景库的贡献兴趣！本指南将帮助您提交高质量的攻击场景。

## 🎯 贡献目标

我们欢迎以下类型的贡献：

- 🆕 新的攻击场景
- 🔄 现有场景的改进和更新
- 📚 参考资料和论文链接
- 🛡️ 新的防御缓解措施
- 🌍 多语言攻击示例

## 📋 贡献流程

### 1. Fork 和克隆

```bash
git fork https://github.com/your-org/lobster-academy.git
git clone https://github.com/your-username/lobster-academy.git
cd lobster-academy/attacks
```

### 2. 创建场景文件

复制模板文件：

```bash
cp templates/attack_template.yaml templates/my_attack.yaml
```

### 3. 填写场景详情

按照模板格式填写您的攻击场景。每个字段都很重要：

- **id**: 唯一标识符，格式为 `XX-NNN`（如 `PI-011`）
- **name**: 简洁描述性名称
- **category**: 攻击分类（见下方分类列表）
- **severity**: 严重等级 1-10
- **description**: 详细的攻击描述
- **attack_prompt**: 攻击者可能使用的提示词示例
- **expected_behavior**: 正确的安全响应应该是什么
- **mitigation**: 推荐的防御措施
- **references**: 相关论文、文章或资源链接

### 4. 验证场景

提交前运行验证脚本：

```bash
python3 validate.py templates/my_attack.yaml
```

### 5. 提交 Pull Request

```bash
git checkout -b add-attack/my-attack-name
git add templates/my_attack.yaml
git commit -m "添加攻击场景：[场景名称]"
git push origin add-attack/my-attack-name
```

然后在 GitHub 上创建 Pull Request。

## 🏷️ 攻击分类

| 分类 ID | 中文名称 | 描述 |
|---------|----------|------|
| `prompt_injection` | 提示词注入 | 通过输入注入覆盖系统指令 |
| `jailbreak` | 越狱攻击 | 绕过模型安全限制 |
| `data_exfiltration` | 数据泄露 | 提取系统或用户数据 |
| `privilege_escalation` | 权限提升 | 获取未授权的系统权限 |
| `context_manipulation` | 上下文操控 | 操纵对话上下文 |
| `indirect_injection` | 间接注入 | 通过外部数据源注入 |
| `encoding_bypass` | 编码绕过 | 使用编码技术绕过检测 |
| `resource_exhaustion` | 资源耗尽 | 消耗系统资源 |
| `social_engineering` | 社会工程 | 利用人性的攻击 |

## ⚠️ 严重等级说明

| 等级 | 名称 | 描述 |
|------|------|------|
| 1-2 | 低 | 信息泄露风险低，影响有限 |
| 3-4 | 中低 | 可能导致轻微信息泄露 |
| 5-6 | 中 | 可能绕过部分安全限制 |
| 7-8 | 高 | 可能导致严重安全问题 |
| 9-10 | 严重 | 可能导致系统完全失陷 |

## ✅ 场景质量标准

### 必须满足

- [ ] 攻击描述清晰准确
- [ ] 提供具体可复现的攻击示例
- [ ] 包含有效的防御缓解措施
- [ ] 严重等级评估合理
- [ ] 至少提供一个参考链接

### 加分项

- [ ] 包含多个变体或变种
- [ ] 提供学术论文引用
- [ ] 包含代码示例（如适用）
- [ ] 考虑了绕过防御的进阶攻击

## 🔒 安全和伦理

### 请遵循以下原则

1. **防御优先**: 所有场景应服务于防御目的
2. **最小化危害**: 不要提供完整的可执行攻击代码
3. **负责任披露**: 如发现真实漏洞，请通过负责任渠道报告
4. **教育目的**: 所有内容仅供安全教育和研究使用

### 禁止内容

- 完整的漏洞利用代码（可提供概念证明）
- 针对特定真实系统或个人的攻击
- 任何非法或有害的内容

## 📝 提交模板

请使用 `templates/attack_template.yaml` 模板。您也可以使用 GitHub Issue 模板提交场景建议。

## 🙏 致谢

所有贡献者将在项目 README 中被致谢。感谢您帮助提高 AI 系统的安全性！

## 📞 联系方式

如有任何问题，请通过以下方式联系我们：

- GitHub Issues: [项目 Issues 页面]
- Email: security@lobster-academy.org
