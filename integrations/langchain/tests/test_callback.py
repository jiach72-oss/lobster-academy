"""Tests for LobsterCallbackHandler and LobsterToolWrapper."""

from __future__ import annotations

import uuid
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

import pytest

from lobster_academy_langchain.callback import LobsterCallbackHandler
from lobster_academy_langchain.tool_wrapper import LobsterToolWrapper, wrap_tool_function


# ─── Fixtures ────────────────────────────────────────────────────────


@pytest.fixture
def storage():
    """Create a stub Storage for testing."""

    class StubStorage:
        def __init__(self) -> None:
            self.records: List[Dict[str, Any]] = []

        def record(self, event: Dict[str, Any]) -> str:
            self.records.append(event)
            return event.get("event_id", str(uuid.uuid4()))

    return StubStorage()


@pytest.fixture
def redactor():
    """Create a stub Redactor that passes data through."""

    class StubRedactor:
        def redact(self, data: Any) -> Any:
            if isinstance(data, str):
                return data.replace("SECRET", "[REDACTED]")
            return data

    return StubRedactor()


@pytest.fixture
def handler(storage, redactor):
    """Create a LobsterCallbackHandler with test fixtures."""
    return LobsterCallbackHandler(
        agent_id="test-agent-001",
        redactor=redactor,
        storage=storage,
        verbose=True,
    )


@pytest.fixture
def run_id():
    return uuid.UUID("12345678-1234-5678-1234-567812345678")


@pytest.fixture
def parent_run_id():
    return uuid.UUID("87654321-4321-8765-4321-876543218765")


# ─── Callback Handler Tests ────────────────────────────────────────


class TestLobsterCallbackHandler:
    """Test suite for LobsterCallbackHandler."""

    def test_init_default_agent_id(self):
        """Test that agent_id is auto-generated if not provided."""
        handler = LobsterCallbackHandler()
        assert handler.agent_id.startswith("agent_")
        assert len(handler.agent_id) == 18  # "agent_" + 12 hex chars

    def test_init_custom_agent_id(self, handler):
        """Test that custom agent_id is used."""
        assert handler.agent_id == "test-agent-001"

    def test_on_chain_start_records_event(self, handler, storage, run_id):
        """Test that chain start events are recorded."""
        serialized = {"name": "TestChain", "id": ["test", "TestChain"]}
        inputs = {"query": "test input"}

        handler.on_chain_start(
            serialized=serialized,
            inputs=inputs,
            run_id=run_id,
        )

        assert len(storage.records) == 1
        event = storage.records[0]
        assert event["event_type"] == "chainStart"
        assert event["agent_id"] == "test-agent-001"
        assert event["chain_name"] == "TestChain"
        assert "timestamp" in event

    def test_on_chain_end_records_duration(self, handler, storage, run_id):
        """Test that chain end records duration."""
        serialized = {"name": "TestChain"}
        handler.on_chain_start(
            serialized=serialized,
            inputs={},
            run_id=run_id,
        )

        handler.on_chain_end(
            outputs={"result": "done"},
            run_id=run_id,
        )

        assert len(storage.records) == 2
        end_event = storage.records[1]
        assert end_event["event_type"] == "chainEnd"
        assert end_event["duration_ms"] is not None
        assert end_event["duration_ms"] >= 0

    def test_on_tool_start_and_end(self, handler, storage, run_id):
        """Test tool start and end recording."""
        serialized = {"name": "calculator", "id": ["tools", "calculator"]}

        handler.on_tool_start(
            serialized=serialized,
            input_str="2 + 2",
            run_id=run_id,
        )
        handler.on_tool_end(output="4", run_id=run_id)

        assert len(storage.records) == 2
        assert storage.records[0]["event_type"] == "toolStart"
        assert storage.records[0]["tool_name"] == "calculator"
        assert storage.records[1]["event_type"] == "toolEnd"
        assert storage.records[1]["output"] == "4"

    def test_on_tool_error_records_error(self, handler, storage, run_id):
        """Test tool error recording."""
        serialized = {"name": "failing_tool"}
        handler.on_tool_start(
            serialized=serialized,
            input_str="input",
            run_id=run_id,
        )

        error = ValueError("Something went wrong with SECRET data")
        handler.on_tool_error(error=error, run_id=run_id)

        assert len(storage.records) == 2
        error_event = storage.records[1]
        assert error_event["event_type"] == "toolError"
        assert error_event["error_type"] == "ValueError"
        assert "[REDACTED]" in error_event["error_message"]

    def test_on_llm_start_records_prompts(self, handler, storage, run_id):
        """Test LLM start records prompts."""
        serialized = {"name": "OpenAI"}
        prompts = ["Hello, who are you?", "My SECRET password is 123"]

        handler.on_llm_start(
            serialized=serialized,
            prompts=prompts,
            run_id=run_id,
        )

        assert len(storage.records) == 1
        event = storage.records[0]
        assert event["event_type"] == "llmStart"
        assert len(event["prompts"]) == 2
        assert "[REDACTED]" in event["prompts"][1]

    def test_on_agent_action_records_decision(self, handler, storage, run_id):
        """Test agent action recording."""
        from langchain.schema.agent import AgentAction

        action = AgentAction(
            tool="search",
            tool_input="weather in Shanghai",
            log="I need to search for the weather.",
        )

        handler.on_agent_action(action=action, run_id=run_id)

        assert len(storage.records) == 1
        event = storage.records[0]
        assert event["event_type"] == "agentAction"
        assert event["tool"] == "search"

    def test_on_agent_finish_records_completion(self, handler, storage, run_id):
        """Test agent finish recording."""
        from langchain.schema.agent import AgentFinish

        finish = AgentFinish(
            return_values={"output": "The weather is sunny."},
            log="Final answer: The weather is sunny.",
        )

        handler.on_agent_finish(finish=finish, run_id=run_id)

        assert len(storage.records) == 1
        event = storage.records[0]
        assert event["event_type"] == "agentFinish"
        assert "return_values" in event

    def test_disabled_callbacks_not_recorded(self, storage, redactor):
        """Test that disabled callback types are skipped."""
        handler = LobsterCallbackHandler(
            agent_id="test-agent",
            redactor=redactor,
            storage=storage,
            record_llm=False,
            record_chain=False,
            record_tool=False,
            record_agent=False,
        )

        run_id = uuid.uuid4()

        handler.on_chain_start(
            serialized={"name": "test"}, inputs={}, run_id=run_id
        )
        handler.on_tool_start(
            serialized={"name": "test"}, input_str="x", run_id=run_id
        )
        handler.on_llm_start(
            serialized={"name": "test"}, prompts=["x"], run_id=run_id
        )

        assert len(storage.records) == 0

    def test_parent_run_id_tracked(self, handler, storage, run_id, parent_run_id):
        """Test that parent_run_id is recorded in events."""
        handler.on_chain_start(
            serialized={"name": "child"},
            inputs={},
            run_id=run_id,
            parent_run_id=parent_run_id,
        )

        event = storage.records[0]
        assert event["parent_run_id"] == str(parent_run_id)

    def test_chain_error_records_error(self, handler, storage, run_id):
        """Test chain error recording."""
        handler.on_chain_start(
            serialized={"name": "failing_chain"},
            inputs={},
            run_id=run_id,
        )

        error = RuntimeError("Chain failed with SECRET info")
        handler.on_chain_error(error=error, run_id=run_id)

        assert len(storage.records) == 2
        error_event = storage.records[1]
        assert error_event["event_type"] == "chainError"
        assert error_event["error_type"] == "RuntimeError"
        assert "[REDACTED]" in error_event["error_message"]


# ─── Tool Wrapper Tests ─────────────────────────────────────────────


class TestLobsterToolWrapper:
    """Test suite for LobsterToolWrapper."""

    def test_wrap_preserves_tool_name(self, storage, redactor):
        """Test that wrapping preserves the tool name."""
        from langchain.tools import Tool

        def add(a: str) -> str:
            return str(eval(a))

        tool = Tool(name="calculator", description="Add numbers", func=add)
        wrapper = LobsterToolWrapper(
            agent_id="test-agent", redactor=redactor, storage=storage
        )
        wrapped = wrapper.wrap(tool)

        assert wrapped.name == "calculator"

    def test_wrap_records_start_and_end(self, storage, redactor):
        """Test that wrapped tools record start and end events."""
        from langchain.tools import Tool

        def echo(text: str) -> str:
            return f"Echo: {text}"

        tool = Tool(name="echo", description="Echo input", func=echo)
        wrapper = LobsterToolWrapper(
            agent_id="test-agent", redactor=redactor, storage=storage
        )
        wrapped = wrapper.wrap(tool)

        result = wrapped.run("hello")

        assert result == "Echo: hello"
        assert len(storage.records) == 2
        assert storage.records[0]["event_type"] == "toolCallStart"
        assert storage.records[1]["event_type"] == "toolCallEnd"
        assert storage.records[1]["success"] is True

    def test_wrap_records_error(self, storage, redactor):
        """Test that tool errors are recorded."""
        from langchain.tools import Tool

        def failing_tool(input_str: str) -> str:
            raise ValueError("Tool broke")

        tool = Tool(name="fail", description="Always fails", func=failing_tool)
        wrapper = LobsterToolWrapper(
            agent_id="test-agent", redactor=redactor, storage=storage
        )
        wrapped = wrapper.wrap(tool)

        with pytest.raises(ValueError, match="Tool broke"):
            wrapped.run("input")

        assert len(storage.records) == 2
        error_event = storage.records[1]
        assert error_event["event_type"] == "toolCallError"
        assert error_event["success"] is False

    def test_wrap_tools_batch(self, storage, redactor):
        """Test batch wrapping of multiple tools."""
        from langchain.tools import Tool

        tools = [
            Tool(name=f"tool_{i}", description=f"Tool {i}", func=lambda x: x)
            for i in range(3)
        ]

        wrapper = LobsterToolWrapper(
            agent_id="test-agent", redactor=redactor, storage=storage
        )
        wrapped = wrapper.wrap_tools(tools)

        assert len(wrapped) == 3
        for i, t in enumerate(wrapped):
            assert t.name == f"tool_{i}"

    def test_wrap_redacts_input(self, storage, redactor):
        """Test that inputs are redacted before recording."""
        from langchain.tools import Tool

        def process(data: str) -> str:
            return f"Processed: {data}"

        tool = Tool(name="process", description="Process data", func=process)
        wrapper = LobsterToolWrapper(
            agent_id="test-agent", redactor=redactor, storage=storage
        )
        wrapped = wrapper.wrap(tool)

        wrapped.run("My SECRET information")

        start_event = storage.records[0]
        assert start_event["event_type"] == "toolCallStart"
        assert "[REDACTED]" in start_event["input"]


# ─── Convenience Function Tests ─────────────────────────────────────


class TestWrapToolFunction:
    """Test suite for wrap_tool_function convenience."""

    def test_creates_and_wraps_function(self):
        """Test that wrap_tool_function creates a wrapped tool from a function."""
        def greet(name: str) -> str:
            return f"Hello, {name}!"

        tool = wrap_tool_function(
            func=greet,
            name="greeter",
            description="Greet someone",
        )

        assert tool.name == "greeter"
        result = tool.run("World")
        assert result == "Hello, World!"


# ─── Integration Tests ──────────────────────────────────────────────


class TestIntegration:
    """Integration tests combining callback handler and tool wrapper."""

    def test_handler_and_wrapper_share_storage(self, storage, redactor):
        """Test that handler and wrapper can share the same storage."""
        handler = LobsterCallbackHandler(
            agent_id="integration-agent",
            redactor=redactor,
            storage=storage,
        )
        wrapper = LobsterToolWrapper(
            agent_id="integration-agent",
            redactor=redactor,
            storage=storage,
        )

        from langchain.tools import Tool
        from langchain.schema.agent import AgentAction, AgentFinish

        tool = Tool(name="test", description="Test tool", func=lambda x: x)
        wrapped = wrapper.wrap(tool)

        # Simulate agent flow
        run_id = uuid.uuid4()
        handler.on_agent_action(
            action=AgentAction(tool="test", tool_input="hello", log="Using test tool"),
            run_id=run_id,
        )
        wrapped.run("hello")
        handler.on_agent_finish(
            finish=AgentFinish(return_values={"output": "done"}, log="Finished"),
            run_id=run_id,
        )

        # All events in shared storage
        event_types = [e["event_type"] for e in storage.records]
        assert "agentAction" in event_types
        assert "toolCallStart" in event_types
        assert "toolCallEnd" in event_types
        assert "agentFinish" in event_types
