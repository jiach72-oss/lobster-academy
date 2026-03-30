"""Tests for LobsterLlamaIndexHandler."""

from __future__ import annotations

import uuid
from typing import Any, Dict, List
from unittest.mock import MagicMock

import pytest

from lobster_academy_llamaindex.callback import LobsterLlamaIndexHandler


# Try importing LlamaIndex types; skip tests if not installed
try:
    from llama_index.core.callbacks.schema import CBEventType, EventPayload
    LLAMAINDEX_AVAILABLE = True
except ImportError:
    LLAMAINDEX_AVAILABLE = False
    CBEventType = None  # type: ignore
    EventPayload = None  # type: ignore


pytestmark = pytest.mark.skipif(
    not LLAMAINDEX_AVAILABLE, reason="llama-index-core not installed"
)


@pytest.fixture
def storage():
    class StubStorage:
        def __init__(self) -> None:
            self.records: List[Dict[str, Any]] = []

        def record(self, event: Dict[str, Any]) -> str:
            self.records.append(event)
            return event.get("event_id", str(uuid.uuid4()))

    return StubStorage()


@pytest.fixture
def redactor():
    class StubRedactor:
        def redact(self, data: Any) -> Any:
            if isinstance(data, str):
                return data.replace("SECRET", "[REDACTED]")
            return data

    return StubRedactor()


@pytest.fixture
def handler(storage, redactor):
    return LobsterLlamaIndexHandler(
        agent_id="test-llama-agent",
        redactor=redactor,
        storage=storage,
        verbose=True,
    )


class TestLobsterLlamaIndexHandler:

    def test_init_default_agent_id(self):
        h = LobsterLlamaIndexHandler()
        assert h.agent_id.startswith("agent_")

    def test_init_custom_agent_id(self, handler):
        assert handler.agent_id == "test-llama-agent"

    def test_llm_event_start_end(self, handler, storage):
        event_id = handler.on_event_start(
            event_type=CBEventType.LLM,
            payload={EventPayload.PROMPT: "What is the SECRET meaning of life?"},
            event_id="llm-001",
        )

        handler.on_event_end(
            event_type=CBEventType.LLM,
            payload={EventPayload.COMPLETION: "42"},
            event_id="llm-001",
        )

        assert len(storage.records) == 2
        start = storage.records[0]
        end = storage.records[1]
        assert start["event_type"] == "llmStart"
        assert end["event_type"] == "llmEnd"
        assert "[REDACTED]" in start["payload"]["prompt"]
        assert end["duration_ms"] is not None

    def test_query_event(self, handler, storage):
        handler.on_event_start(
            event_type=CBEventType.QUERY,
            payload={EventPayload.QUERY_STR: "Find SECRET documents"},
            event_id="query-001",
        )

        assert len(storage.records) == 1
        event = storage.records[0]
        assert event["event_type"] == "queryStart"
        assert "[REDACTED]" in event["payload"]["query"]

    def test_retrieve_event_with_nodes(self, handler, storage):
        mock_node = MagicMock()
        mock_node.score = 0.95

        handler.on_event_start(
            event_type=CBEventType.RETRIEVE,
            payload={EventPayload.QUERY_STR: "test query"},
            event_id="ret-001",
        )
        handler.on_event_end(
            event_type=CBEventType.RETRIEVE,
            payload={EventPayload.NODES: [mock_node, mock_node]},
            event_id="ret-001",
        )

        end_event = storage.records[1]
        assert end_event["event_type"] == "retrieveEnd"
        assert end_event["payload"]["num_nodes"] == 2

    def test_embedding_event(self, handler, storage):
        handler.on_event_start(
            event_type=CBEventType.EMBEDDING,
            payload={EventPayload.CHUNKS: ["chunk1", "chunk2", "chunk3"]},
            event_id="emb-001",
        )
        handler.on_event_end(
            event_type=CBEventType.EMBEDDING,
            payload={EventPayload.CHUNKS: ["chunk1", "chunk2", "chunk3"]},
            event_id="emb-001",
        )

        start_event = storage.records[0]
        assert start_event["payload"]["num_chunks"] == 3

    def test_agent_step_event(self, handler, storage):
        handler.on_event_start(
            event_type=CBEventType.AGENT_STEP,
            event_id="step-001",
        )
        handler.on_event_end(
            event_type=CBEventType.AGENT_STEP,
            event_id="step-001",
        )

        assert len(storage.records) == 2
        assert storage.records[0]["event_type"] == "agentStepStart"
        assert storage.records[1]["event_type"] == "agentStepEnd"

    def test_function_call_event(self, handler, storage):
        mock_fc = MagicMock()
        mock_fc.name = "search"
        mock_fc.arguments = {"query": "SECRET data"}

        handler.on_event_start(
            event_type=CBEventType.FUNCTION_CALL,
            payload={EventPayload.FUNCTION_CALL: mock_fc},
            event_id="fc-001",
        )

        event = storage.records[0]
        assert event["payload"]["function_name"] == "search"
        assert "[REDACTED]" in event["payload"]["function_args"]

    def test_trace_start_end(self, handler, storage):
        handler.start_trace("trace-001")
        handler.end_trace("trace-001")

        assert len(storage.records) == 2
        assert storage.records[0]["event_type"] == "traceStart"
        assert storage.records[1]["event_type"] == "traceEnd"

    def test_parent_id_tracked(self, handler, storage):
        handler.on_event_start(
            event_type=CBEventType.SYNTHESIZE,
            event_id="syn-001",
            parent_id="query-001",
        )

        event = storage.records[0]
        assert event["parent_id"] == "query-001"

    def test_unknown_event_type_fallback(self, handler, storage):
        """Test that unknown event types are handled gracefully."""
        handler.on_event_start(
            event_type=CBEventType.NODE_PARSING,
            event_id="np-001",
        )
        handler.on_event_end(
            event_type=CBEventType.NODE_PARSING,
            event_id="np-001",
        )

        assert storage.records[0]["event_type"] == "nodeParsingStart"
        assert storage.records[1]["event_type"] == "nodeParsingEnd"

    def test_duration_calculated(self, handler, storage):
        import time

        handler.on_event_start(
            event_type=CBEventType.LLM,
            event_id="llm-dur",
        )
        time.sleep(0.05)  # 50ms
        handler.on_event_end(
            event_type=CBEventType.LLM,
            event_id="llm-dur",
        )

        end_event = storage.records[1]
        assert end_event["duration_ms"] is not None
        assert end_event["duration_ms"] >= 40  # Allow some tolerance
