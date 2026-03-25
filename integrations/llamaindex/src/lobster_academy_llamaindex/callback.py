"""Lobster Academy Callback Handler for LlamaIndex.

Captures LLM calls, embeddings, retrieval, and query events as
verifiable behavior evidence for Lobster Academy.
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from llama_index.core.callbacks.base_handler import BaseCallbackHandler
from llama_index.core.callbacks.schema import CBEventType, EventPayload

try:
    from lobster_academy import Redactor, Storage
except ImportError:
    class Redactor:
        def redact(self, data: Any) -> Any:
            return data

    class Storage:
        def __init__(self, **kwargs: Any) -> None:
            self.records: List[Dict[str, Any]] = []

        def record(self, event: Dict[str, Any]) -> str:
            self.records.append(event)
            return str(uuid.uuid4())


# Map LlamaIndex event types to Lobster event names
_EVENT_TYPE_MAP: Dict[CBEventType, str] = {
    CBEventType.LLM: "llm",
    CBEventType.EMBEDDING: "embedding",
    CBEventType.RETRIEVE: "retrieve",
    CBEventType.QUERY: "query",
    CBEventType.SYNTHESIZE: "synthesize",
    CBEventType.TREE: "tree",
    CBEventType.CHUNKING: "chunking",
    CBEventType.NODE_PARSING: "nodeParsing",
    CBEventType.FUNCTION_CALL: "functionCall",
    CBEventType.AGENT_STEP: "agentStep",
    CBEventType.RERANKING: "reranking",
    CBEventType.TEMPLATING: "templating",
}


class LobsterLlamaIndexHandler(BaseCallbackHandler):
    """LlamaIndex Callback Handler for Lobster Academy behavior recording.

    Captures all LlamaIndex events during index construction, querying,
    and agent execution. All data passes through a Redactor before storage.

    Args:
        agent_id: Unique identifier for the agent/query instance.
        redactor: Custom Redactor for data sanitization.
        storage: Custom Storage for event persistence.
        event_starts_to_ignore: Event types to skip on start.
        event_ends_to_ignore: Event types to skip on end.
        verbose: Whether to print events to stdout.
    """

    def __init__(
        self,
        agent_id: Optional[str] = None,
        redactor: Optional[Redactor] = None,
        storage: Optional[Storage] = None,
        event_starts_to_ignore: Optional[List[CBEventType]] = None,
        event_ends_to_ignore: Optional[List[CBEventType]] = None,
        verbose: bool = False,
    ) -> None:
        super().__init__(
            event_starts_to_ignore=event_starts_to_ignore or [],
            event_ends_to_ignore=event_ends_to_ignore or [],
        )
        self.agent_id = agent_id or f"agent_{uuid.uuid4().hex[:12]}"
        self.redactor = redactor or Redactor()
        self.storage = storage or Storage()
        self.verbose = verbose

        self._start_times: Dict[str, float] = {}

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _lobster_event_type(self, event_type: CBEventType) -> str:
        return _EVENT_TYPE_MAP.get(event_type, event_type.value)

    def _record(self, event: Dict[str, Any]) -> str:
        if self.verbose:
            print(f"[Lobster] {event['event_type']}: {event.get('event_id', 'N/A')}")
        return self.storage.record(event)

    def on_event_start(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: str = "",
        parent_id: str = "",
        **kwargs: Any,
    ) -> str:
        """Record the start of a LlamaIndex event.

        Args:
            event_type: The type of event.
            payload: Event payload data.
            event_id: Unique event identifier.
            parent_id: Parent event identifier.

        Returns:
            The event_id.
        """
        event_id = event_id or str(uuid.uuid4())
        self._start_times[event_id] = time.monotonic()

        lobster_type = self._lobster_event_type(event_type)

        # Extract and redact payload data
        payload_data: Dict[str, Any] = {}
        if payload:
            if EventPayload.CHUNKS in payload:
                payload_data["num_chunks"] = len(payload[EventPayload.CHUNKS])
                payload_data["chunks_preview"] = [
                    self.redactor.redact(c[:200]) for c in payload[EventPayload.CHUNKS][:3]
                ]
            if EventPayload.PROMPT in payload:
                payload_data["prompt"] = self.redactor.redact(
                    str(payload[EventPayload.PROMPT])
                )
            if EventPayload.QUERY_STR in payload:
                payload_data["query"] = self.redactor.redact(
                    payload[EventPayload.QUERY_STR]
                )
            if EventPayload.NODES in payload:
                payload_data["num_nodes"] = len(payload[EventPayload.NODES])
            if EventPayload.TEMPLATE in payload:
                payload_data["template"] = self.redactor.redact(
                    str(payload[EventPayload.TEMPLATE])
                )
            if EventPayload.FUNCTION_CALL in payload:
                fc = payload[EventPayload.FUNCTION_CALL]
                payload_data["function_name"] = getattr(fc, "name", "unknown")
                payload_data["function_args"] = self.redactor.redact(
                    str(getattr(fc, "arguments", {}))
                )
            if EventPayload.TOOL in payload:
                tool = payload[EventPayload.TOOL]
                payload_data["tool_name"] = getattr(tool, "name", "unknown")

        event = {
            "event_id": event_id,
            "agent_id": self.agent_id,
            "event_type": f"{lobster_type}Start",
            "run_id": event_id,
            "parent_id": parent_id or None,
            "timestamp": self._now_iso(),
            "payload": payload_data,
        }
        self._record(event)
        return event_id

    def on_event_end(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: str = "",
        parent_id: str = "",
        **kwargs: Any,
    ) -> None:
        """Record the end of a LlamaIndex event.

        Args:
            event_type: The type of event.
            payload: Event payload data (e.g., LLM response, retrieved nodes).
            event_id: Unique event identifier.
            parent_id: Parent event identifier.
        """
        start = self._start_times.pop(event_id, None)
        duration_ms = int((time.monotonic() - start) * 1000) if start else None

        lobster_type = self._lobster_event_type(event_type)

        # Extract and redact end payload
        payload_data: Dict[str, Any] = {}
        if payload:
            if EventPayload.RESPONSE in payload:
                resp = payload[EventPayload.RESPONSE]
                payload_data["response"] = self.redactor.redact(str(resp))
            if EventPayload.COMPLETION in payload:
                payload_data["completion"] = self.redactor.redact(
                    str(payload[EventPayload.COMPLETION])
                )
            if EventPayload.NODES in payload:
                nodes = payload[EventPayload.NODES]
                payload_data["num_nodes"] = len(nodes)
                payload_data["node_scores"] = [
                    round(getattr(n, "score", 0) or 0, 4) for n in nodes[:10]
                ]
            if EventPayload.CHUNKS in payload:
                payload_data["num_chunks"] = len(payload[EventPayload.CHUNKS])

        event = {
            "event_id": str(uuid.uuid4()),
            "agent_id": self.agent_id,
            "event_type": f"{lobster_type}End",
            "run_id": event_id,
            "parent_id": parent_id or None,
            "timestamp": self._now_iso(),
            "duration_ms": duration_ms,
            "payload": payload_data,
        }
        self._record(event)

    def start_trace(self, trace_id: Optional[str] = None) -> None:
        """Start a new trace for grouping related events."""
        if trace_id:
            self._record({
                "event_id": str(uuid.uuid4()),
                "agent_id": self.agent_id,
                "event_type": "traceStart",
                "trace_id": trace_id,
                "timestamp": self._now_iso(),
            })

    def end_trace(
        self,
        trace_id: Optional[str] = None,
        trace_map: Optional[Dict[str, List[str]]] = None,
    ) -> None:
        """End a trace and optionally record the event tree."""
        if trace_id:
            event: Dict[str, Any] = {
                "event_id": str(uuid.uuid4()),
                "agent_id": self.agent_id,
                "event_type": "traceEnd",
                "trace_id": trace_id,
                "timestamp": self._now_iso(),
            }
            if trace_map:
                event["trace_map"] = {
                    k: [self.redactor.redact(str(v)) for v in vs]
                    for k, vs in trace_map.items()
                }
            self._record(event)
