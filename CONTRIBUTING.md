# 🤝 贡献指南 / Contributing Guide

感谢你对 MirrorAI 的兴趣！我们欢迎所有形式的贡献。

Thank you for your interest in MirrorAI! We welcome all forms of contributions.

---

## 📋 如何贡献 / How to Contribute

### 报告问题 / Report Issues

1. 在 [Issues](https://github.com/jiach72-oss/lobster-academy/issues) 中搜索是否已有相同问题
2. 如果没有，创建新的 Issue，包含：
   - 清晰的问题描述
   - 复现步骤
   - 预期行为 vs 实际行为
   - 环境信息（Node.js 版本、操作系统等）

<!-- English -->
1. Search [Issues](https://github.com/jiach72-oss/lobster-academy/issues) to see if the problem already exists
2. If not, create a new Issue with:
   - Clear problem description
   - Steps to reproduce
   - Expected behavior vs actual behavior
   - Environment info (Node.js version, OS, etc.)

### 提交代码 / Submit Code

1. **Fork** 本仓库 / Fork this repository
2. 创建功能分支 / Create feature branch: `git checkout -b feature/amazing-feature`
3. 提交更改 / Commit changes: `git commit -m 'Add amazing feature'`
4. 推送分支 / Push branch: `git push origin feature/amazing-feature`
5. 创建 **Pull Request**

---

## 🔧 开发规范 / Development Standards

### 代码风格 / Code Style

- 使用 TypeScript 严格模式 / Use TypeScript strict mode
- 遵循 ESLint 规则 / Follow ESLint rules
- 所有公开 API 必须有 JSDoc 注释 / All public APIs must have JSDoc comments

### 测试要求 / Testing Requirements

- 新功能必须包含测试 / New features must include tests
- 运行 `npm test` 确保所有测试通过 / Run `npm test` to ensure all tests pass
- 测试覆盖率不低于 80% / Test coverage must be at least 80%

### 提交信息 / Commit Messages

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式 / Use Conventional Commits format:

```
feat: 添加新的脱敏模式 / Add new redaction pattern
fix: 修复签名验证的边界情况 / Fix edge case in signature verification
docs: 更新 API 文档 / Update API documentation
test: 添加 Redactor 测试用例 / Add Redactor test cases
refactor: 重构存储层接口 / Refactor storage layer interface
```

---

## 🏗️ 项目结构 / Project Structure

```
sdk/
├── src/
│   ├── index.ts           # 入口文件 / Entry point
│   ├── recorder.ts        # 行为录制 / Behavior recording
│   ├── redactor.ts        # 数据脱敏 / Data redaction
│   ├── reporter.ts        # 报告生成 / Report generation
│   ├── signer.ts          # 数字签名 / Digital signature
│   ├── academy.ts         # 评测引擎 / Evaluation engine
│   ├── adversarial-engine.ts  # 对抗测试 / Adversarial testing
│   ├── attack-scenarios.ts    # 攻击场景 / Attack scenarios
│   ├── types.ts           # 类型定义 / Type definitions
│   ├── errors.ts          # 错误处理 / Error handling
│   └── storage/           # 存储层 / Storage layer
├── cli/                   # CLI 工具 / CLI tools
├── tests/                 # 测试文件 / Test files
├── docs/                  # 文档 / Documentation
└── examples/              # 示例代码 / Example code
```

---

## 🔒 安全贡献 / Security Contributions

### 脱敏模式 / Redaction Patterns

添加新的脱敏模式时 / When adding new redaction patterns:

1. 在 `src/redactor.ts` 中添加模式定义 / Add pattern definition in `src/redactor.ts`
2. 添加对应的测试用例 / Add corresponding test cases
3. 评估置信度等级（high/medium/low） / Evaluate confidence level
4. 确保不会产生过多误报 / Ensure minimal false positives

### 攻击场景 / Attack Scenarios

添加新的攻击场景时 / When adding new attack scenarios:

1. 在 `src/attack-scenarios.ts` 中定义场景 / Define scenario in `src/attack-scenarios.ts`
2. 实现攻击向量 / Implement attack vector
3. 添加评估标准 / Add evaluation criteria
4. 编写防御建议 / Write defense recommendations

---

## 📝 文档贡献 / Documentation Contributions

- 文档位于 `docs/` 目录 / Documentation is in `docs/` directory
- 使用 Markdown 格式 / Use Markdown format
- 代码示例必须可运行 / Code examples must be runnable
- 中英文文档都需要更新 / Both Chinese and English docs need updates

---

## 🐛 Bug 报告模板 / Bug Report Template

```markdown
**描述 / Description**
清晰简洁地描述问题。/ Describe the issue clearly and concisely.

**复现步骤 / Steps to Reproduce**
1. 执行 '...' / Execute '...'
2. 点击 '...' / Click '...'
3. 滚动到 '...' / Scroll to '...'
4. 看到错误 / See error

**预期行为 / Expected Behavior**
描述你期望发生的行为。/ Describe what you expected to happen.

**截图 / Screenshots**
如果适用，添加截图。/ If applicable, add screenshots.

**环境 / Environment**
- OS: [e.g. macOS 14.0]
- Node.js: [e.g. 20.10.0]
- SDK版本/Version: [e.g. 0.1.0]
```

---

## 💡 功能请求模板 / Feature Request Template

```markdown
**问题 / Problem**
描述你遇到的问题。/ Describe the problem you're facing.

**解决方案 / Solution**
描述你希望的解决方案。/ Describe the solution you'd like.

**替代方案 / Alternatives**
描述你考虑过的其他解决方案。/ Describe alternatives you've considered.

**附加信息 / Additional Info**
任何其他相关信息。/ Any other relevant information.
```

---

## 🏆 贡献者 / Contributors

感谢所有贡献者！/ Thanks to all contributors!

<!-- 这里会自动更新贡献者列表 / This will auto-update with contributor list -->

---

## 📄 许可证 / License

通过贡献代码，你同意你的贡献将在 [Apache License 2.0](LICENSE) 下发布。

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
