"""压力测试 - 高并发、大数据量、长时间运行.

压力测试 1: 高并发录制 (100 线程 × 100 事件 = 10,000)
压力测试 2: 大数据量脱敏 (10MB+ 文本, 1000 次脱敏)
压力测试 3: 大量签名验证 (1000 密钥对, 10,000 签名)
压力测试 4: 攻击场景全覆盖 (53 种 × 100 轮 = 5,300)
压力测试 5: 长时间运行 (60 秒, 每秒 10 事件)
"""

from __future__ import annotations

import gc
import threading
import time

import pytest

from lobster_academy import (
    AdversarialEngine,
    RecordEvent,
    Recorder,
    Redactor,
    Signer,
    ToolCall,
)


# ---------------------------------------------------------------------------
# 压力测试 1: 高并发录制
# ---------------------------------------------------------------------------

class TestConcurrentRecording:
    """100 个并发线程, 每个录制 100 事件, 总计 10,000."""

    def test_high_concurrency_recording(self):
        storage_shared = Recorder("stress-agent", storage=None)._storage
        # 每个线程用自己的 Recorder 共享同一 storage
        THREAD_COUNT = 100
        EVENTS_PER_THREAD = 100
        TOTAL = THREAD_COUNT * EVENTS_PER_THREAD

        errors: list[Exception] = []
        lock = threading.Lock()
        recorders = [Recorder(f"stress-thread-{tid}") for tid in range(THREAD_COUNT)]

        def worker(thread_id: int):
            try:
                rec = recorders[thread_id]
                for i in range(EVENTS_PER_THREAD):
                    ev = RecordEvent(
                        type="inference",
                        input=f"thread-{thread_id}-event-{i}",
                        output=f"response-{thread_id}-{i}",
                    )
                    rec.record(ev)
            except Exception as e:
                with lock:
                    errors.append(e)

        threads = [threading.Thread(target=worker, args=(tid,)) for tid in range(THREAD_COUNT)]

        start = time.time()
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        elapsed = time.time() - start

        # 统计总事件数
        total_recorded = sum(len(recorders[i].get_events()) for i in range(THREAD_COUNT))

        assert len(errors) == 0, f"并发错误: {errors}"
        assert total_recorded == TOTAL, f"事件丢失: {total_recorded}/{TOTAL}"
        assert elapsed < 60, f"耗时过长: {elapsed:.1f}s"

        print(f"\n[压力测试1] {TOTAL} 事件, {THREAD_COUNT} 线程, 耗时 {elapsed:.2f}s, 吞吐量 {TOTAL/elapsed:.0f} events/s")


# ---------------------------------------------------------------------------
# 压力测试 2: 大数据量脱敏
# ---------------------------------------------------------------------------

class TestBulkRedaction:
    """生成 10MB+ 文本含大量敏感数据, 批量脱敏."""

    def test_large_text_redaction(self):
        redactor = Redactor()

        # 生成含手机号的文本, ~39 字符/行
        phone_chunk = "联系人手机号 13912345678 邮箱 test@example.com\n"
        text = phone_chunk * 260000  # ~10.1M chars

        assert len(text) > 10_000_000, f"文本大小 {len(text)} < 10M"

        start = time.time()
        redacted = redactor.redact_string(text)
        elapsed = time.time() - start

        assert "13912345678" not in redacted, "手机号未脱敏"
        assert "test@example.com" not in redacted, "邮箱未脱敏"
        assert elapsed < 30, f"脱敏耗时 {elapsed:.1f}s 超过 30 秒"

        print(f"\n[压力测试2a] 文本 {len(text)/1e6:.1f}MB, 脱敏耗时 {elapsed:.2f}s")

    def test_batch_redaction_1000(self):
        """1000 次脱敏操作."""
        redactor = Redactor()
        texts = [
            f"用户{i} 手机 138{i:08d} 邮箱 user{i}@test.com 身份证 11010519900307{i:04d}"
            for i in range(1000)
        ]

        start = time.time()
        results = [redactor.redact_string(t) for t in texts]
        elapsed = time.time() - start

        assert len(results) == 1000
        assert elapsed < 10, f"批量脱敏耗时 {elapsed:.1f}s 超过 10 秒"

        for r in results:
            assert "[REDACTED]" in r

        print(f"\n[压力测试2b] 1000 次脱敏, 耗时 {elapsed:.2f}s, 吞吐量 {1000/elapsed:.0f} ops/s")


# ---------------------------------------------------------------------------
# 压力测试 3: 大量签名验证
# ---------------------------------------------------------------------------

class TestBulkSigning:
    """1000 密钥对, 签名 10,000 条数据, 验证全部."""

    def test_sign_and_verify_10000(self):
        KEY_COUNT = 1000
        SIGN_COUNT = 10000

        # 生成密钥对和签名者
        key_pairs = [Signer.generate_key_pair() for _ in range(KEY_COUNT)]
        signers = [Signer(priv) for priv, _ in key_pairs]

        # 准备数据
        data_list = [f"data-item-{i}".encode() for i in range(SIGN_COUNT)]

        # 签名
        signatures = [None] * SIGN_COUNT
        start_sign = time.time()
        for i, data in enumerate(data_list):
            signatures[i] = signers[i % KEY_COUNT].sign(data)
        sign_elapsed = time.time() - start_sign

        # 验证
        start_verify = time.time()
        for i, data in enumerate(data_list):
            _, pub = key_pairs[i % KEY_COUNT]
            assert Signer.verify(data, signatures[i], pub) is True
        verify_elapsed = time.time() - start_verify

        total = sign_elapsed + verify_elapsed
        print(f"\n[压力测试3] {KEY_COUNT} 密钥, {SIGN_COUNT} 签名+验证")
        print(f"  签名耗时: {sign_elapsed:.2f}s")
        print(f"  验证耗时: {verify_elapsed:.2f}s")
        print(f"  总耗时: {total:.2f}s, 吞吐量 {SIGN_COUNT/total:.0f} ops/s")

        assert total < 120, f"总耗时 {total:.1f}s 超过 120 秒"


# ---------------------------------------------------------------------------
# 压力测试 4: 攻击场景全覆盖
# ---------------------------------------------------------------------------

class TestAdversarialStress:
    """运行全部攻击场景 × 100 轮 = 5,300 次."""

    def test_all_scenarios_100_rounds(self):
        engine = AdversarialEngine()

        def safe_handler(user_input: str) -> str:
            return "I'm sorry, I can't help with that request."

        # 先运行一次确认场景数
        base_results = engine.run_all_attacks(safe_handler)
        scenario_count = len(base_results)
        assert scenario_count >= 10, f"场景数 {scenario_count} 不足"

        ROUNDS = 100
        total = scenario_count * ROUNDS
        errors = 0

        start = time.time()
        for _ in range(ROUNDS):
            try:
                engine.run_all_attacks(safe_handler)
            except Exception:
                errors += 1
        elapsed = time.time() - start

        assert errors == 0, f"出现 {errors} 个错误"
        print(f"\n[压力测试4] {scenario_count} 场景 × {ROUNDS} 轮 = {total} 次, 耗时 {elapsed:.2f}s")


# ---------------------------------------------------------------------------
# 压力测试 5: 长时间运行
# ---------------------------------------------------------------------------

class TestLongRunning:
    """模拟 Agent 持续运行 60 秒, 每秒 10 事件, ~600 事件."""

    def test_sustained_recording(self):
        recorder = Recorder("long-running-agent")

        DURATION = 60  # 秒
        EVENTS_PER_SEC = 10

        gc.collect()
        import tracemalloc
        tracemalloc.start()

        start = time.time()
        event_count = 0

        while time.time() - start < DURATION:
            ev = RecordEvent(
                type="inference",
                input=f"sustained-event-{event_count}",
                output=f"response-{event_count}",
            )
            recorder.record(ev)
            event_count += 1
            # 控制速率 ~10/s
            target_time = start + (event_count / EVENTS_PER_SEC)
            sleep_time = target_time - time.time()
            if sleep_time > 0:
                time.sleep(sleep_time)

        elapsed = time.time() - start
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        assert event_count >= 500, f"事件数 {event_count} 不足 500"
        assert peak < 200 * 1024 * 1024, f"内存峰值 {peak/1e6:.1f}MB 过高"

        print(f"\n[压力测试5] {event_count} 事件, {elapsed:.1f}s, 内存峰值 {peak/1e6:.1f}MB")
