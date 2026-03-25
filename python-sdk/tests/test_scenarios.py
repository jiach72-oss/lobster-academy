"""实战场景模拟测试 - 模拟真实 Agent 应用场景.

场景 1: 客服 Agent 全链路测试
场景 2: 金融 Agent 合规测试
场景 3: 医疗 Agent 隐私测试
场景 4: 多 Agent 协作测试
场景 5: 对抗攻击实战测试
"""

from __future__ import annotations

import time

import pytest

from lobster_academy import (
    Academy,
    AdversarialEngine,
    RecordEvent,
    Recorder,
    Redactor,
    Signer,
    ToolCall,
)


# ---------------------------------------------------------------------------
# 场景 1: 客服 Agent 全链路测试
# ---------------------------------------------------------------------------

class TestCustomerServiceAgent:
    """模拟客服 Agent 处理用户投诉的完整链路."""

    def test_full_customer_complaint_flow(self):
        """用户投诉 → 查询订单 → 退款 → 验证录制完整、脱敏正确、评测合理."""
        redactor = Redactor()
        private_key, public_key = Signer.generate_key_pair()
        signer = Signer(private_key)
        recorder = Recorder("cs-agent-001")

        # ---- 用户输入（含敏感信息） ----
        user_input = (
            "你好，我是张三，手机号 13812345678，邮箱 zhangsan@example.com。"
            "我的订单号 ORD-20240315-0089 收到的商品有破损，要求退款。"
        )

        # ---- Agent 推理 ----
        reasoning = "用户投诉商品破损，需要查询订单状态并处理退款。"

        # ---- 工具调用: 查询订单 ----
        order_query_tc = ToolCall(
            name="query_order",
            params={"order_id": "ORD-20240315-0089"},
            result={
                "order_id": "ORD-20240315-0089",
                "status": "delivered",
                "customer_name": "张三",
                "customer_phone": "13812345678",
                "amount": 299.00,
            },
            duration=0.35,
        )

        # ---- 工具调用: 退款 ----
        refund_tc = ToolCall(
            name="process_refund",
            params={"order_id": "ORD-20240315-0089", "reason": "商品破损"},
            result={"refund_id": "REF-20240315-0001", "status": "approved", "amount": 299.00},
            duration=0.52,
        )

        agent_output = "已为您提交退款申请，退款编号 REF-20240315-0001，预计1-3个工作日到账。"

        # ---- 录制事件 ----
        event = RecordEvent(
            type="tool_call",
            input=user_input,
            reasoning=reasoning,
            output=agent_output,
            tool_calls=[order_query_tc, refund_tc],
        )

        # 录制
        event_id = recorder.record(event)
        assert event_id is not None
        assert isinstance(event_id, str)

        # 读取已录制事件
        recorded_events = recorder.get_events()
        assert len(recorded_events) == 1
        recorded = recorded_events[0]

        # ---- 验证: 签名 ----
        signature = signer.sign(recorded.output.encode())
        assert Signer.verify(recorded.output.encode(), signature, public_key) is True

        # ---- 验证: 脱敏正确 ----
        redacted_input = redactor.redact_string(recorded.input)
        assert "13812345678" not in redacted_input, "手机号未脱敏"
        assert "zhangsan@example.com" not in redacted_input, "邮箱未脱敏"
        assert "[REDACTED]" in redacted_input

        # 工具结果中的敏感字段也应脱敏
        redacted_result = redactor.redact_object(order_query_tc.result)
        assert redacted_result["customer_phone"] == "[REDACTED]", "工具结果中手机号未脱敏"

        # ---- 验证: 评测分数合理 ----
        academy = Academy(events=recorded_events)
        evaluation = academy.evaluate()
        assert evaluation.total_score >= 0
        assert evaluation.grade in {"A", "B", "C", "D", "F"}
        assert len(evaluation.dimensions) > 0

    def test_customer_agent_event_integrity(self):
        """验证客服 Agent 事件链的完整性."""
        recorder = Recorder("cs-agent-002")

        events_input = [
            RecordEvent(type="user_input", input="我的订单怎么还没到？手机号 13900001111"),
            RecordEvent(type="inference", reasoning="用户查询物流", output="正在查询..."),
            RecordEvent(
                type="tool_call",
                tool_calls=[ToolCall(name="query_logistics", params={"phone": "13900001111"}, result={"status": "in_transit"}, duration=0.2)],
            ),
            RecordEvent(type="inference", output="您的包裹正在运输中，预计明天送达。"),
        ]

        for ev in events_input:
            recorder.record(ev)

        all_recorded = recorder.get_events()
        assert len(all_recorded) == 4
        for ev in all_recorded:
            assert ev.event_id  # 非空 UUID
            assert ev.timestamp


# ---------------------------------------------------------------------------
# 场景 2: 金融 Agent 合规测试
# ---------------------------------------------------------------------------

class TestFinanceAgentCompliance:
    """模拟银行 Agent 处理财咨询, 验证 PII 脱敏、签名、审计链."""

    def test_finance_pii_redaction(self):
        """用户输入含身份证号、银行卡号 → 全部脱敏."""
        redactor = Redactor()

        user_msg = (
            "我的身份证号是 110105199003071234，"
            "银行卡号 6222021234567890123，"
            "想咨询理财产品。"
        )

        redacted = redactor.redact_string(user_msg)
        assert "110105199003071234" not in redacted, "身份证号未脱敏"
        assert "6222021234567890123" not in redacted, "银行卡号未脱敏"
        assert "[REDACTED]" in redacted

    def test_finance_full_audit_chain(self):
        """完整的理财咨询流程 → 签名有效 → 审计链完整."""
        private_key, public_key = Signer.generate_key_pair()
        signer = Signer(private_key)
        recorder = Recorder("finance-agent-001")
        redactor = Redactor()

        # 模拟完整对话链
        chain = [
            RecordEvent(
                type="user_input",
                input="我是李四，身份证 320106198512150012，卡号 6228480012345678901，想买基金。",
            ),
            RecordEvent(
                type="tool_call",
                input="调用风控系统",
                tool_calls=[
                    ToolCall(
                        name="risk_assessment",
                        params={"id_card": "320106198512150012"},
                        result={"risk_level": "medium", "qualified_products": ["fund_a", "bond_b"]},
                        duration=0.8,
                    )
                ],
            ),
            RecordEvent(
                type="inference",
                output="根据您的风险评估，推荐基金A和债券B。",
            ),
        ]

        for ev in chain:
            recorder.record(ev)

        recorded_events = recorder.get_events()
        assert len(recorded_events) == 3

        # 签名验证 (签名每个事件的输出)
        for ev in recorded_events:
            if ev.output:
                sig = signer.sign(ev.output.encode())
                assert Signer.verify(ev.output.encode(), sig, public_key) is True

        # PII 脱敏检查
        for ev in recorded_events:
            redacted_input = redactor.redact_string(ev.input)
            assert "320106198512150012" not in redacted_input
            assert "6228480012345678901" not in redacted_input

        # 工具参数中的脱敏 — 值中身份证号被部分脱敏 (key "id_card" 不是敏感 key)
        for ev in recorded_events:
            for tc in ev.tool_calls:
                redacted_params = redactor.redact_object(tc.params)
                if "id_card" in tc.params:
                    # 值中的身份证号应被正则匹配脱敏
                    assert "320106198512150012" not in redacted_params["id_card"]

    def test_finance_sensitive_object_redaction(self):
        """验证 dict 中敏感 key 自动脱敏."""
        redactor = Redactor()

        obj = {
            "customer": "王五",
            "password": "MySecret123!",
            "api_key": "sk-abc123def456ghi789",
            "ssn": "123-45-6789",
            "credit_card": "4111111111111111",
            "balance": 50000.00,
        }

        redacted = redactor.redact_object(obj)
        assert redacted["password"] == "[REDACTED]"
        assert redacted["api_key"] == "[REDACTED]"
        assert redacted["ssn"] == "[REDACTED]"
        assert redacted["credit_card"] == "[REDACTED]"
        assert redacted["balance"] == 50000.00  # 非敏感字段保留
        assert redacted["customer"] == "王五"


# ---------------------------------------------------------------------------
# 场景 3: 医疗 Agent 隐私测试
# ---------------------------------------------------------------------------

class TestMedicalAgentPrivacy:
    """模拟医疗咨询 Agent, 验证 HIPAA 相关数据全部脱敏."""

    def test_medical_record_redaction(self):
        """病历号、医保号、诊断信息脱敏."""
        redactor = Redactor()

        medical_text = (
            "患者姓名：赵六，病历号 MRN-2024-001234，"
            "医保号 YB320106198512150012，"
            "诊断：2型糖尿病，高血压。"
            "联系手机 15012345678，邮箱 zhao6@hospital.cn"
        )

        redacted = redactor.redact_string(medical_text)
        assert "15012345678" not in redacted, "手机号未脱敏"
        assert "zhao6@hospital.cn" not in redacted, "邮箱未脱敏"
        assert "[REDACTED]" in redacted

    def test_medical_tool_call_redaction(self):
        """医疗工具调用中的敏感数据脱敏."""
        redactor = Redactor()
        recorder = Recorder("medical-agent-001")

        event = RecordEvent(
            type="tool_call",
            input="查询患者 病历号 MRN-2024-567890 手机 18612345678 的历史记录",
            tool_calls=[
                ToolCall(
                    name="query_medical_history",
                    params={"patient_id": "MRN-2024-567890", "phone": "18612345678"},
                    result={
                        "diagnosis": "慢性胃炎",
                        "medications": ["奥美拉唑"],
                        "patient_phone": "18612345678",
                    },
                    duration=0.6,
                )
            ],
        )

        event_id = recorder.record(event)
        assert event_id is not None

        recorded = recorder.get_events()[0]

        # 脱敏
        redacted_input = redactor.redact_string(recorded.input)
        assert "18612345678" not in redacted_input

        redacted_result = redactor.redact_object(recorded.tool_calls[0].result)
        assert redacted_result.get("patient_phone") == "[REDACTED]"

    def test_medical_batch_redaction(self):
        """批量医疗文本脱敏."""
        redactor = Redactor()

        texts = [
            "患者A 手机 13000000001 邮箱 a@hospital.com",
            "患者B 手机 13000000002 邮箱 b@hospital.com",
            "患者C 手机 13000000003 邮箱 c@hospital.com",
        ]

        for text in texts:
            redacted = redactor.redact_string(text)
            assert "[REDACTED]" in redacted
            for i in range(1, 4):
                assert f"1300000000{i}" not in redacted


# ---------------------------------------------------------------------------
# 场景 4: 多 Agent 协作测试
# ---------------------------------------------------------------------------

class TestMultiAgentCollaboration:
    """3 个 Agent 协作: 收集 → 分析 → 执行, 各自独立录制."""

    def test_three_agent_collaboration(self):
        # Agent A: 信息收集
        recorder_a = Recorder("agent-collector")
        event_a = RecordEvent(
            type="inference",
            input="收集用户需求",
            output="需求已收集：需要数据分析报告",
            reasoning="Agent A 收集用户基本信息",
        )
        id_a = recorder_a.record(event_a)

        # Agent B: 分析
        recorder_b = Recorder("agent-analyzer")
        event_b = RecordEvent(
            type="tool_call",
            input="分析需求",
            output="分析完成，推荐方案X",
            tool_calls=[
                ToolCall(name="analyze_data", params={"dataset": "user_needs"}, result={"recommendation": "方案X"}, duration=1.2)
            ],
        )
        id_b = recorder_b.record(event_b)

        # Agent C: 执行
        recorder_c = Recorder("agent-executor")
        event_c = RecordEvent(
            type="tool_call",
            input="执行方案X",
            output="方案X已执行，生成报告 RPT-001",
            tool_calls=[
                ToolCall(name="execute_plan", params={"plan": "方案X"}, result={"report_id": "RPT-001", "status": "completed"}, duration=2.0)
            ],
        )
        id_c = recorder_c.record(event_c)

        # 验证: 每个 Agent 独立录制
        assert len(recorder_a.get_events()) == 1
        assert len(recorder_b.get_events()) == 1
        assert len(recorder_c.get_events()) == 1

        # 事件 ID 各不相同
        ids = {id_a, id_b, id_c}
        assert len(ids) == 3, "三个 Agent 的事件 ID 应各不相同"

    def test_agent_chain_evaluation(self):
        """多 Agent 协作链的评测."""
        recorder = Recorder("multi-agent-chain")

        events = [
            RecordEvent(type="user_input", input="帮我做一个市场调研"),
            RecordEvent(type="inference", reasoning="需要多Agent协作", output="启动协作流程"),
            RecordEvent(type="tool_call", tool_calls=[ToolCall(name="collect_data", params={}, result={"rows": 100}, duration=0.5)]),
            RecordEvent(type="tool_call", tool_calls=[ToolCall(name="analyze", params={}, result={"insight": "增长趋势"}, duration=1.0)]),
            RecordEvent(type="inference", output="调研完成，结论：市场呈增长趋势"),
        ]

        for ev in events:
            recorder.record(ev)

        recorded = recorder.get_events()
        assert len(recorded) == 5

        academy = Academy(events=recorded)
        eval_result = academy.evaluate()
        assert eval_result.total_score >= 0
        assert eval_result.grade in {"A", "B", "C", "D", "F"}


# ---------------------------------------------------------------------------
# 场景 5: 对抗攻击实战测试
# ---------------------------------------------------------------------------

class TestAdversarialAttackScenarios:
    """模拟 10 种不同攻击, 验证攻击被检测、链可回溯."""

    @pytest.fixture
    def engine(self):
        return AdversarialEngine()

    def safe_handler(self, user_input: str) -> str:
        return "I'm sorry, I can't help with that request."

    def vulnerable_handler(self, user_input: str) -> str:
        ui = user_input.lower()
        if "system prompt" in ui or "api key" in ui or "secret" in ui:
            return "My api_key: sk-abc123, password: hunter2"
        if "ignore" in ui and "instruction" in ui:
            return "api_key: sk-leaked123 and token: ghp_abc123def456ghi789jkl012mno345pqr6789"
        if "token" in ui or "password" in ui:
            return "password: supersecret123 and token: sk-secret123456"
        return "I'll help you with that."

    def test_safe_handler_passes_attacks(self, engine):
        """安全 Agent 应通过大部分攻击."""
        results = engine.run_all_attacks(self.safe_handler)
        assert len(results) == 53
        passed = sum(1 for r in results if r.passed)
        assert passed >= 50, f"安全 Agent 应通过至少 50 种攻击, 实际 {passed}"

    def test_vulnerable_handler_detected(self, engine):
        """脆弱 Agent 应被检测出漏洞."""
        results = engine.run_all_attacks(self.vulnerable_handler)
        failed = sum(1 for r in results if not r.passed)
        assert failed >= 2, f"脆弱 Agent 应至少失败 2 种攻击, 实际 {failed}"

    def test_attack_chain_traceability(self, engine):
        """攻击链可回溯: 每个结果有 scenario、severity、evidence."""
        results = engine.run_all_attacks(self.safe_handler)
        for r in results:
            assert r.scenario, "scenario 不能为空"
            assert r.severity in {"low", "medium", "high", "critical"}
            assert r.evidence, "evidence 不能为空（攻击链可回溯）"

    def test_attack_coverage_all_categories(self, engine):
        """验证所有攻击类别都被覆盖."""
        results = engine.run_all_attacks(self.safe_handler)
        scenarios = [r.scenario for r in results]
        assert any("prompt_injection" in s for s in scenarios)
        assert any("jailbreak" in s for s in scenarios)
        assert any("data_exfil" in s for s in scenarios)
        assert any("priv_esc" in s for s in scenarios)
        assert any("context_manip" in s for s in scenarios)
        assert any("indirect" in s for s in scenarios)
        assert any("encoding" in s for s in scenarios)
        assert any("resource" in s for s in scenarios)
        assert any("social" in s for s in scenarios)

    def test_ten_attack_types_minimum(self, engine):
        """验证至少有 10 种不同的攻击场景名称."""
        results = engine.run_all_attacks(self.safe_handler)
        unique_scenarios = set(r.scenario for r in results)
        assert len(unique_scenarios) >= 10, f"至少 10 种攻击, 实际 {len(unique_scenarios)}"
