"""边界条件测试 - 极端输入、特殊字符、异常情况.

测试项:
- 空字符串输入
- 超长字符串 (1MB+)
- Unicode 特殊字符 (emoji、RTL、零宽字符)
- None/null 值
- 嵌套 100 层的 dict
- 循环引用
- 并发访问同一资源
- 异常中断恢复
"""

from __future__ import annotations

import threading
import time

import pytest

from lobster_academy import (
    RecordEvent,
    Recorder,
    Redactor,
    Signer,
    ToolCall,
)


# ---------------------------------------------------------------------------
# 空字符串
# ---------------------------------------------------------------------------

class TestEmptyStrings:
    def test_empty_input_redaction(self):
        redactor = Redactor()
        assert redactor.redact_string("") == ""

    def test_empty_event(self):
        recorder = Recorder("edge-test-empty")
        ev = RecordEvent(type="inference", input="", output="")
        event_id = recorder.record(ev)
        assert event_id is not None
        events = recorder.get_events()
        assert len(events) == 1
        assert events[0].input == ""
        assert events[0].output == ""

    def test_empty_tool_call(self):
        recorder = Recorder("edge-test-empty-tool")
        ev = RecordEvent(type="tool_call", tool_calls=[ToolCall(name="", params={}, result=None)])
        event_id = recorder.record(ev)
        assert event_id is not None

    def test_empty_agent_id_raises(self):
        """空 agent_id 应抛出 ValueError."""
        with pytest.raises(ValueError):
            Recorder("")


# ---------------------------------------------------------------------------
# 超长字符串
# ---------------------------------------------------------------------------

class TestVeryLongStrings:
    def test_1mb_string_redaction(self):
        redactor = Redactor()
        big = "安全文本 " * 250000  # ~1.25MB (5 Chinese chars per chunk)
        assert len(big) >= 1_000_000, f"字符串长度 {len(big)} 不足 1M"
        result = redactor.redact_string(big)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_1mb_event_output(self):
        recorder = Recorder("edge-test-1mb")
        big_output = "x" * 1_500_000
        ev = RecordEvent(type="inference", input="test", output=big_output)
        event_id = recorder.record(ev)
        assert event_id is not None
        events = recorder.get_events()
        assert len(events) == 1
        assert len(events[0].output) == 1_500_000

    def test_long_tool_params(self):
        recorder = Recorder("edge-test-long-params")
        big_params = {"data": "y" * 500_000}
        ev = RecordEvent(
            type="tool_call",
            tool_calls=[ToolCall(name="big_tool", params=big_params, result="ok")],
        )
        event_id = recorder.record(ev)
        assert event_id is not None


# ---------------------------------------------------------------------------
# Unicode 特殊字符
# ---------------------------------------------------------------------------

class TestUnicodeEdgeCases:
    def test_emoji(self):
        redactor = Redactor()
        text = "用户反馈 🎉🚀💯 手机 13800000000 😊"
        result = redactor.redact_string(text)
        assert "13800000000" not in result
        assert "🎉" in result  # emoji 应保留

    def test_rtl_text(self):
        """从右到左文字 (阿拉伯语)."""
        redactor = Redactor()
        text = "مرحبا العالم"  # Hello World in Arabic
        result = redactor.redact_string(text)
        assert result  # 不崩溃

    def test_zero_width_characters(self):
        """零宽字符."""
        redactor = Redactor()
        text = "te\u200bst\u200c"  # zero-width space & non-joiner
        result = redactor.redact_string(text)
        assert result  # 不崩溃

    def test_mixed_unicode_event(self):
        recorder = Recorder("edge-test-unicode")
        ev = RecordEvent(
            type="inference",
            input="中文 English 日本語 🇨🇳 العربية",
            output="mixed response русский",
        )
        event_id = recorder.record(ev)
        assert event_id is not None

    def test_null_bytes(self):
        redactor = Redactor()
        text = "before\x00after"
        result = redactor.redact_string(text)
        assert result  # 不崩溃

    def test_surrogate_pairs(self):
        """超出 BMP 的字符."""
        redactor = Redactor()
        text = "测试字符 𩸽 手机 13800000001"
        result = redactor.redact_string(text)
        assert "13800000001" not in result

    def test_emoji_in_tool_result(self):
        """工具结果含 emoji."""
        redactor = Redactor()
        obj = {"message": "完成 ✅", "phone": "13800000002"}
        result = redactor.redact_object(obj)
        assert "✅" in result["message"]
        assert result["phone"] == "[REDACTED]"


# ---------------------------------------------------------------------------
# None / null 值
# ---------------------------------------------------------------------------

class TestNoneValues:
    def test_none_redaction(self):
        redactor = Redactor()
        assert redactor.redact_string(None) is None

    def test_none_tool_result(self):
        recorder = Recorder("edge-test-none")
        ev = RecordEvent(
            type="tool_call",
            tool_calls=[ToolCall(name="test", params={}, result=None, duration=0)],
        )
        event_id = recorder.record(ev)
        assert event_id is not None

    def test_redact_object_none(self):
        redactor = Redactor()
        # None 作为独立值
        assert redactor.redact_object(None) is None

    def test_redact_object_list_with_none(self):
        redactor = Redactor()
        result = redactor.redact_object([None, "hello", None])
        assert result == [None, "hello", None]


# ---------------------------------------------------------------------------
# 嵌套 100 层 dict
# ---------------------------------------------------------------------------

class TestDeepNesting:
    def test_100_level_nested_dict(self):
        redactor = Redactor()
        d = {"value": "safe"}
        for i in range(100):
            d = {"level": i, "nested": d}
        result = redactor.redact_object(d)
        assert result  # 不崩溃
        assert result["level"] == 99

    def test_deep_nested_with_sensitive(self):
        redactor = Redactor()
        d = {"password": "secret123"}
        for i in range(50):
            d = {"inner": d}
        result = redactor.redact_object(d)
        # 找到最深层
        node = result
        while "inner" in node:
            node = node["inner"]
        assert node["password"] == "[REDACTED]"

    def test_deep_nested_event(self):
        """嵌套深的 tool result."""
        recorder = Recorder("edge-test-deep-nest")
        deep_result = {"level": 0}
        for i in range(50):
            deep_result = {"data": deep_result, "level": i}
        ev = RecordEvent(
            type="tool_call",
            tool_calls=[ToolCall(name="deep", params={}, result=deep_result)],
        )
        event_id = recorder.record(ev)
        assert event_id is not None


# ---------------------------------------------------------------------------
# 循环引用
# ---------------------------------------------------------------------------

class TestCircularReference:
    def test_redact_circular_list(self):
        """循环引用的 list — 应安全处理."""
        redactor = Redactor()
        lst: list = [1, 2, 3]
        lst.append(lst)  # 自引用
        try:
            result = redactor.redact_object(lst)
            assert result is not None
        except RecursionError:
            pass  # 可接受

    def test_self_referencing_dict(self):
        """自引用 dict."""
        redactor = Redactor()
        d: dict = {"name": "test"}
        d["self"] = d
        try:
            result = redactor.redact_object(d)
            assert result["name"] == "test"
        except RecursionError:
            pass  # 可接受


# ---------------------------------------------------------------------------
# 并发访问同一资源
# ---------------------------------------------------------------------------

class TestConcurrentAccess:
    def test_concurrent_redactor(self):
        """多线程同时使用同一个 Redactor."""
        redactor = Redactor()
        results = []
        errors = []
        lock = threading.Lock()

        def worker(thread_id):
            try:
                text = f"用户{thread_id} 手机 138{thread_id:08d} 邮箱 u{thread_id}@test.com"
                r = redactor.redact_string(text)
                with lock:
                    results.append(r)
            except Exception as e:
                with lock:
                    errors.append(e)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(50)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0, f"并发错误: {errors}"
        assert len(results) == 50
        for r in results:
            assert "[REDACTED]" in r

    def test_concurrent_signer(self):
        """多线程同时签名."""
        private_key, public_key = Signer.generate_key_pair()
        signer = Signer(private_key)
        errors = []

        def worker(i):
            try:
                data = f"data-{i}".encode()
                sig = signer.sign(data)
                assert Signer.verify(data, sig, public_key) is True
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(50)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0, f"并发签名错误: {errors}"

    def test_concurrent_recorder_different_agents(self):
        """多线程用不同 agent_id 录制."""
        errors = []
        results = {}
        lock = threading.Lock()

        def worker(i):
            try:
                rec = Recorder(f"concurrent-agent-{i}")
                ev = RecordEvent(type="inference", input=f"data-{i}")
                eid = rec.record(ev)
                with lock:
                    results[i] = eid
            except Exception as e:
                with lock:
                    errors.append(e)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(50)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0, f"并发录制错误: {errors}"
        assert len(results) == 50


# ---------------------------------------------------------------------------
# 异常中断恢复
# ---------------------------------------------------------------------------

class TestRecovery:
    def test_recorder_continues_after_invalid_type(self):
        """无效 type 后, Recorder 应继续正常工作."""
        recorder = Recorder("edge-test-recovery")
        # 正常事件
        ev1 = RecordEvent(type="inference", input="ok")
        id1 = recorder.record(ev1)
        assert id1 is not None

        # 非标准 type (不一定是无效)
        ev2 = RecordEvent(type="unknown_type", input="non-standard")
        id2 = recorder.record(ev2)

        # 之后仍应正常工作
        ev3 = RecordEvent(type="inference", input="still ok")
        id3 = recorder.record(ev3)
        assert id3 is not None

        events = recorder.get_events()
        assert len(events) == 3

    def test_signer_after_empty_data(self):
        """签名空数据后继续正常工作."""
        private_key, public_key = Signer.generate_key_pair()
        signer = Signer(private_key)

        # 签名空数据
        sig1 = signer.sign(b"")
        assert Signer.verify(b"", sig1, public_key) is True

        # 继续正常签名
        sig2 = signer.sign(b"normal data")
        assert Signer.verify(b"normal data", sig2, public_key) is True

    def test_redactor_after_malformed_input(self):
        """格式异常输入后, Redactor 继续正常."""
        redactor = Redactor()

        weird_inputs = ["", "\x00\x01\x02", "a" * 100000, None]

        for w in weird_inputs:
            try:
                redactor.redact_string(w)
            except Exception:
                pass

        # 之后正常工作
        result = redactor.redact_string("邮箱 test@example.com")
        assert "[REDACTED]" in result

    def test_redactor_with_locale(self):
        """locale 特定脱敏."""
        redactor = Redactor()
        # 非法 locale 不崩溃
        result = redactor.redact_with_locale("hello world", "XX")
        assert result == "hello world"

    def test_auto_detect_empty(self):
        """空文本自动检测不崩溃."""
        redactor = Redactor()
        result = redactor.auto_detect_and_redact("")
        assert result["text"] == ""
        assert result["detected_locale"] is None
