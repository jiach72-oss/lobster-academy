# 🪞 MirrorAI - Python SDK

AI Agent 行为证据平台。录制、脱敏、评测、对抗测试、签名 —— 一站式 SDK。

## 安装

```bash
pip install lobster-academy
```

## 快速开始

```python
from lobster_academy import Recorder, Redactor, Academy, AdversarialEngine, Signer, RecordEvent, ToolCall
```

### 🎬 Recorder - 事件录制

```python
recorder = Recorder("my-agent-001")

event = RecordEvent(
    type="inference",
    input="What is the weather?",
    output="It's 72°F and sunny.",
    reasoning="Called weather API for NYC",
    tool_calls=[ToolCall(name="get_weather", params={"city": "NYC"}, result="72F sunny", duration=0.5)],
)

recorder.record(event)
events = recorder.replay()  # 按时间排序
```

### 🔒 Redactor - 脱敏

```python
redactor = Redactor()

# 字符串脱敏
clean = redactor.redact_string("Email: user@example.com, SSN: 123-45-6789")
# "Email: [REDACTED], SSN: [REDACTED]"

# 对象脱敏
data = {"username": "admin", "password": "secret123", "email": "a@b.com"}
safe = redactor.redact_object(data)
# {"username": "admin", "password": "[REDACTED]", "email": "[REDACTED]"}
```

**覆盖 200+ 模式：** 邮箱、电话（中美）、身份证（中国）、信用卡、SSN、AWS Key、OpenAI Key、GitHub Token、JWT、私钥、数据库连接串等。

### 📊 Academy - 评测

```python
academy = Academy(events=recorder.get_events())
result = academy.evaluate()

print(f"Score: {result.total_score}/100")
print(f"Grade: {result.grade}")
for dim, data in result.dimensions.items():
    print(f"  {dim}: {data['score']}")
```

**5 维度 × 5 指标 = 25 项评测：**
- **Security**: 输入验证、输出泄漏、工具访问控制、Prompt注入抵抗、密钥处理
- **Reasoning**: 响应连贯性、推理链完整性、输入输出相关性、错误恢复、幻觉预防
- **Tooling**: 工具调用成功率、参数准确性、超时处理、工具多样性、错误处理
- **Compliance**: 数据处理合规、日志完整性、审计链、策略遵从、同意处理
- **Stability**: 错误率、响应时间一致性、重试行为、内存管理、优雅降级

### ⚔️ Adversarial - 对抗测试

```python
engine = AdversarialEngine()

def my_agent(input_text):
    # 你的 Agent 逻辑
    return "response"

results = engine.run_all_attacks(my_agent)
for r in results:
    status = "✅ PASS" if r.passed else "❌ FAIL"
    print(f"{status} [{r.severity}] {r.scenario}")
```

**53 种攻击场景：**
| 类别 | 数量 | 示例 |
|------|------|------|
| Prompt Injection | 10 | 指令覆盖、角色扮演注入、分隔符注入 |
| Jailbreak | 8 | DAN、开发者模式、假设场景 |
| Data Exfiltration | 7 | 密钥提取、环境变量、文件系统 |
| Privilege Escalation | 6 | 管理员权限、工具滥用、sudo模拟 |
| Context Manipulation | 5 | 虚假上下文、历史篡改、身份混淆 |
| Indirect Injection | 5 | URL注入、文档注入、代码注释注入 |
| Encoding Bypass | 4 | Base64、ROT13、Unicode、Hex |
| Resource Exhaustion | 4 | Token洪水、递归请求、内存炸弹 |
| Social Engineering | 4 | 权威伪装、紧迫感施压、信任建立 |

### ✍️ Signer - 签名

```python
# 生成密钥对
private_key, public_key = Signer.generate_key_pair()

# 签名
signer = Signer(private_key)
signature = signer.sign(b"important data")

# 验证
valid = Signer.verify(b"important data", signature, public_key)
# True
```

使用 Ed25519 签名算法（cryptography 库）。

## 开发

```bash
# 克隆并安装
cd python-sdk
pip install -e ".[dev]"

# 运行测试
pytest tests/ -v
```

## 许可证

Apache-2.0
