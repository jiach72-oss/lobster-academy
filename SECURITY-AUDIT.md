# 安全审计报告

审计时间: 2026-03-25 (第二轮)
审计范围: MirrorAI 全部 Python 源码（36 个 .py 文件）

## 安全评分: 5.5/10

项目整体架构合理，使用了 `Ed25519` 签名、`yaml.safe_load`、类型注解等良好实践。但存在若干可被攻击者利用的实际漏洞，主要集中在**密钥管理**、**远程更新**、**输入验证**和**时序攻击**方面。

---

## 发现的漏洞

### 🔴 高危漏洞

| 编号 | 类型 | 文件 | 描述 | PoC | 修复建议 |
|------|------|------|------|-----|----------|
| VULN-01 | 硬编码空密码 | `storage/clickhouse_adapter.py:46` | ClickHouse 连接使用硬编码空密码 `password: ""`，任何能访问 ClickHouse 的人均可无认证连接 | 直接连接 ClickHouse 即可，无需密码 | 从环境变量或配置文件读取，不允许空密码 |
| VULN-02 | 远程代码执行风险 | `attacks/updater.py` | `ScenarioUpdater` 从 `raw.githubusercontent.com` 下载 YAML/JSON 文件并直接 `yaml.safe_load()` / `json.load()`，无签名验证、无校验和校验、无 HTTPS 证书验证。攻击者通过 DNS 劫持或 MITM 可注入恶意场景数据 | DNS 劫持 `raw.githubusercontent.com` → 恶意服务器，返回包含 Python 对象的 YAML，`safe_load` 虽阻止任意代码执行，但可注入恶意场景数据污染测试库 | 添加 GPG 签名验证、强制 HTTPS + 证书 pinning、校验和验证 |
| VULN-03 | 时序攻击 | `signer.py:154` | `verify_signature` 使用 `generated == expected` 进行签名比对，这是非恒定时间比较。攻击者可通过精确测量响应时间逐字节推测签名内容 | 使用 `timing_attack` 工具对 Ed25519 签名进行时序分析，逐字节还原签名 | 使用 `hmac.compare_digest(generated, expected)` 替代 `==` |
| VULN-04 | ReDoS 正则拒绝服务 | `patterns/i18n/detector.py` | `I18nDetector` 从外部 `patterns.json` 加载正则表达式并在任意文本上执行，无超时、无回溯限制。恶意构造的正则可导致 CPU 100% | 构造包含 `(a+)+$` 的 patterns.json，用 `aaaaaaaaaaaaaaaaaaaaaaaa!` 作为输入 | 添加正则执行超时（如 `regex` 库的 `timeout` 参数）、限制输入文本长度、对加载的正则做静态分析 |

### 🟡 中危漏洞

| 编号 | 类型 | 文件 | 描述 | 修复建议 |
|------|------|------|------|----------|
| VULN-05 | 敏感数据弱脱敏 | `redactor.py:36` | `REDACTION_PATTERNS` 对 API Key/Token 等敏感数据仅保留最后 4 位 (`secret[-4:]`)，4 字符搜索空间极小，可通过暴力破解还原完整密钥 | 至少保留前 4 位 + 后 4 位（中间用 `***` 替代），或完全遮蔽 |
| VULN-06 | 首字符泄露 | `redactor.py:37` | Secret 类型使用 `secret[:1] + "***"` 模式，泄露密钥首字符。许多密钥有固定前缀（如 `sk-`、`AKIA`），首字符极大缩小搜索空间 | 完全遮蔽为 `[REDACTED_SECRET]`，不泄露任何字符 |
| VULN-07 | Unicode 绕过 | `redactor.py:143` | `redact()` 仅使用 `re.IGNORECASE`，不进行 Unicode NFC/NFD 规范化。攻击者可通过 Unicode 组合字符（如 `ＡＰＩＫＥＹ` 全角字符或 `\u200B` 零宽空格）绕过关键词检测 | 在 `redact()` 入口处添加 `unicodedata.normalize('NFC', text)` 并 strip 零宽字符 |
| VULN-08 | 布尔盲注信息泄露 | `redactor.py:40` | 环境变量值使用 `value[:3] + "***"` 模式，泄露前 3 字符。对于 `AWS_SECRET_ACCESS_KEY` 等，前 3 字符 + 长度可提供有价值信息 | 完全遮蔽为 `[REDACTED]` |
| VULN-09 | Redis 连接无超时 | `storage/redis_adapter.py:46` | `Redis(host=..., port=..., db=..., decode_responses=True)` 未设置 `socket_timeout`、`socket_connect_timeout`、`retry_on_timeout`。Redis 服务器不可达时，客户端会无限阻塞 | 添加 `socket_timeout=5, socket_connect_timeout=5, retry_on_timeout=True` |
| VULN-10 | 远程 URL 无完整性校验 | `attacks/updater.py:37` | `DEFAULT_REMOTE` 使用 `https://raw.githubusercontent.com/...`，下载内容无 GPG/Ed25519 签名验证。GitHub 账号被盗或仓库被篡改后，用户执行 `update` 会自动下载恶意内容 | 添加下载文件的 Ed25519 签名验证（复用 `signer.py`），公钥硬编码在代码中 |

### 🟢 低危问题

| 编号 | 类型 | 文件 | 描述 | 修复建议 |
|------|------|------|------|----------|
| VULN-11 | 前缀不一致 | `redactor.py:32` | `FLAGS_PREFIXES` 包含 `secret`、`token` 等前缀，但 `REDACTION_PATTERNS` 的正则并未全部使用这些前缀，存在检测盲区 | 确保所有正则规则都使用统一的前缀列表 |
| VULN-12 | 嵌套脱敏不完整 | `redactor.py:151` | `_redact_dict` 对嵌套 dict 递归脱敏，但对嵌套 list 仅递归元素，不处理 list 中 dict 的深层嵌套 | 统一使用递归处理所有容器类型 |
| VULN-13 | 异常泄露堆栈 | `attacks/updater.py:170`、`registry.py:205` | 多处 `print(f"... {e}")` 直接打印异常到 stdout，可能泄露文件路径、服务器信息等 | 使用 `logging` 并设置合适的日志级别 |
| VULN-14 | MD5 用于完整性校验 | `attacks/updater.py:68` | 使用 `hashlib.md5` 计算文件哈希，MD5 已被证明不安全（碰撞攻击可行） | 改用 `hashlib.sha256` |

---

## Bug 列表

| 编号 | 文件 | 描述 | 影响 | 修复建议 |
|------|------|------|------|----------|
| BUG-01 | `academy.py:164` | `_build_description()` 方法不存在，`_build_threat_model` 调用了一个未定义的方法 | `run_quick_test()` 运行时抛出 `AttributeError`，快速测试功能完全不可用 | 删除错误调用或改为 `_build_threat_model()` |
| BUG-02 | `academy.py:228` | `_attack_to_result` 方法不存在（只在类型注解中引用，从未定义） | `run_attack` 和 `run_quick_test` 无法正常返回结果 | 实现该方法或移除引用 |
| BUG-03 | `signer.py:142` | `from_file` 中 `key_hex = f.read()` 可能读取空文件，导致 `bytes.fromhex("")` 返回空 bytes，后续 `SigningKey(empty_bytes)` 抛出 `ValueError` | 密钥文件为空时启动失败，错误信息不明确 | 添加空文件检查：`if not key_hex: raise ValueError("密钥文件为空")` |
| BUG-04 | `redactor.py:117` | `_redact_value` 参数类型注解为 `Union[str, int, float, bool, None]`，但方法内部对 `None` 未做处理（`isinstance(value, str)` 对 None 返回 False，直接返回原值） | None 值不被脱敏直接返回，通常无害但不符合预期 | 添加 `if value is None: return value` |
| BUG-05 | `recorder.py:224` | `flush()` 和 `start()`/`record()` 之间存在竞态条件。`_inflight` dict 在多个方法中无锁访问 | 并发场景下可能丢失事件或抛出 RuntimeError（迭代时 dict 大小改变） | 使用 `threading.Lock` 保护 `_inflight` 的访问 |
| BUG-06 | `clickhouse_adapter.py:131` | `store_event` 的 INSERT SQL 使用字符串格式化构建，字段值通过 `str(event.get(...)).replace("'", "\\'")` 转义，单引号转义不完整（反斜杠+单引号在某些模式下不够） | 特殊字符事件可能导致 SQL 语法错误或数据损坏 | 使用 ClickHouse 官方驱动的参数化查询 |
| BUG-07 | `clickhouse_adapter.py:137-146` | INSERT 列与值可能不匹配。`field` 列表来自 `self.fields`，但 event dict 的字段可能缺失或额外 | 插入失败或数据列错位 | 在 INSERT 前验证 event 字段完整性 |
| BUG-08 | `s3_adapter.py:128` | `list_events` 方法未实现（`raise NotImplementedError`），但 `recorder.py` 的 `load_events` 可能调用它 | S3 存储后端无法查询历史事件 | 实现该方法或在 `recorder.py` 中添加 S3 特殊处理 |
| BUG-09 | `s3_adapter.py:101` | `store_event` 使用同步 `put_object`，在高频调用时会严重阻塞 | 高并发场景下 SDK 性能急剧下降 | 使用异步 boto3 或批量上传 |
| BUG-10 | `updater.py:88` | `compare_versions` 使用 `int(x)` 解析版本号，如果版本号包含非数字字符（如 `1.0.0-beta`）会抛出 `ValueError` | 版本号格式稍有变化即崩溃 | 添加异常处理，支持预发布版本号 |
| BUG-11 | `adversarial.py:147` | 超时后 `proc.terminate()` 发送 SIGTERM，但紧接着 `proc.wait()` 无超时。如果进程忽略 SIGTERM（常见于 shell 脚本），会永久挂起 | 攻击超时测试可能挂起整个程序 | 超时后先 `terminate()`，间隔 1 秒后 `kill()` |
| BUG-12 | `validate.py:120` | `validate_scenario` 对 `attack_prompt` 长度无上限检查 | 极长攻击提示词可能耗尽内存进行验证 | 添加 `len(attack_prompt) > 10000` 的检查 |

---

## 代码质量观察（非安全问题）

1. **ClickHouse adapter 大量 stub**：`query_builder`、`list_events`、`get_stats` 均为 `raise NotImplementedError`，说明该存储后端未完成
2. **S3 adapter 部分 stub**：`list_events` 未实现
3. **class variable 共享密钥**：`Ed25519Signer._signing_key` 是类变量，多个实例共享同一密钥。虽不影响当前单例用法，但设计上有隐患
4. **`subprocess.Popen` 的 `universal_newlines=True`**：应使用 `text=True`（Python 3.7+）
5. **`recorder.py` 的同步回调**：`_fire_callbacks` 在记录事件时同步调用所有回调，若回调阻塞则影响记录性能

---

## 安全加固建议

### 立即修复（P0）
1. **修复时序攻击**：`signer.py` 中所有签名比对改用 `hmac.compare_digest()`
2. **移除硬编码空密码**：`clickhouse_adapter.py` 的密码从环境变量读取
3. **修复 `academy.py` 的 `_build_description` 错误调用**（功能完全不可用）

### 短期修复（P1）
4. **增强远程更新安全**：添加 Ed25519 签名验证（复用 `signer.py`），强制 SHA256 校验和
5. **加强 Redactor**：进行 Unicode NFC 规范化，完全遮蔽敏感值，添加零宽字符清理
6. **Redis 连接超时**：添加 `socket_timeout` 和 `socket_connect_timeout`
7. **MD5 → SHA256**：更新 `updater.py` 的文件哈希算法

### 中期加固（P2）
8. **ReDoS 防护**：对 I18n Detector 的正则添加超时限制，限制输入长度
9. **ClickHouse SQL 参数化**：使用驱动原生参数化查询
10. **并发安全**：为 `recorder.py` 的 `_inflight` 添加线程锁
11. **异常日志**：使用 `logging` 替代 `print`，避免信息泄露
12. **输入长度验证**：在所有公共 API 入口添加输入长度限制

### 长期建议（P3）
13. **依赖审计**：定期运行 `pip-audit` / `safety check` 检查依赖漏洞
14. **添加 fuzzing 测试**：对 redactor、signer、detector 添加 fuzz 测试
15. **实现 ClickHouse/S3 adapter 的剩余方法**或明确标记为实验性
16. **添加 CI 安全扫描**：集成 `bandit`（Python 安全扫描器）到 CI 流水线

---

## 审计方法说明

本次审计采用以下方法：
1. **逐文件人工代码审查**：阅读全部 36 个 Python 源文件
2. **关注安全敏感操作**：加密、输入解析、外部连接、文件 I/O、子进程
3. **数据流追踪**：追踪用户输入从入口到最终使用的完整路径
4. **模式匹配**：搜索硬编码凭据、不安全的比较、缺少验证的外部输入

审计未进行运行时测试（未实际启动 Redis/ClickHouse/S3 服务），因此部分运行时问题（如连接超时行为）为静态分析推断。
