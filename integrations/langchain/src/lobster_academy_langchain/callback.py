"""Lobster Academy Callback Handler for LangChain.

Captures agent decisions, tool calls, and LLM interactions as
verifiable behavior evidence for Lobster Academy.
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

from langchain.callbacks.base import BaseCallbackHandler
from langchain.schema.agent import AgentAction, AgentFinish
from langchain.schema.document import Document
from langchain.schema.output import ChatResult, LLMResult

try:
    from lobster_academy import Redactor, Storage
except ImportError:
    # Fallback stubs for development/testing without the core package
    class Redactor:
        """Stub Redactor when lobster_academy is not installed."""

        def redact(self, data: Any) -> Any:
            return data

    class Storage:
        """Stub Storage when lobster_academy is not installed."""

        def __init__(self, **kwargs: Any) -> None:
            self.records: List[Dict[str, Any]] = []

        def record(self, event: Dict[str, Any]) -> str:
            self.records.append(event)
            return str(uuid.uuid4())

        def get_records(
            self,
            agent_id: Optional[str] = None,
            event_type: Optional[str] = None,
            limit: int = 100,
        ) -> List[Dict[str, Any]]:
            """Query recorded events with optional filters."""
            results = self.records
            if agent_id:
                results = [r for r in results if r.get("agent_id") == agent_id]
            if event_type:
                results = [r for r in results if r.get("event_type") == event_type]
            return results[:limit]

        def get_record(self, event_id: str) -> Optional[Dict[str, Any]]:
            """Get a single record by event_id."""
            for r in self.records:
                if r.get("event_id") == event_id:
                    return r
            return None

        def count(self, agent_id: Optional[str] = None) -> int:
            """Count records, optionally filtered by agent_id."""
            if agent_id:
                return sum(1 for r in self.records if r.get("agent_id") == agent_id)
            return len(self.records)

        def clear(self, agent_id: Optional[str] = None) -> None:
            """Clear records, optionally filtered by agent_id."""
            if agent_id:
                self.records = [r for r in self.records if r.get("agent_id") != agent_id]
            else:
                self.records.clear()


class LobsterCallbackHandler(BaseCallbackHandler):
    """LangChain Callback Handler for Lobster Academy behavior recording.

    This handler captures all significant events during LangChain agent
    execution, including chain invocations, tool calls, LLM requests,
    and agent actions/finishes. All captured data is passed through a
    Redactor for PII/sensitive data removal before storage.

    Args:
        agent_id: Unique identifier for the agent instance.
            Auto-generated if not provided.
        redactor: Custom Redactor instance for data sanitization.
            Uses default Redactor if not provided.
        storage: Custom Storage instance for event persistence.
            Uses in-memory storage if not provided.
        record_llm: Whether to record LLM start/end events. Default True.
        record_chain: Whether to record chain start/end events. Default True.
        record_tool: Whether to record tool start/end events. Default True.
        record_agent: Whether to record agent action/finish events. Default True.
        verbose: Whether to print events to stdout. Default False.
    """

    def __init__(
        self,
        agent_id: Optional[str] = None,
        redactor: Optional[Redactor] = None,
        storage: Optional[Storage] = None,
        record_llm: bool = True,
        record_chain: bool = True,
        record_tool: bool = True,
        record_agent: bool = True,
        verbose: bool = False,
    ) -> None:
        super().__init__()
        self.agent_id = agent_id or f"agent_{uuid.uuid4().hex[:12]}"
        self.redactor = redactor or Redactor()
        self.storage = storage or Storage()
        self.record_llm = record_llm
        self.record_chain = record_chain
        self.record_tool = record_tool
        self.record_agent = record_agent
        self.verbose = verbose

        # Track timing for duration calculations
        self._start_times: Dict[str, float] = {}

    def _now_iso(self) -> str:
        """Return current UTC time in ISO 8601 format."""
        return datetime.now(timezone.utc).isoformat()

    def _make_event(
        self,
        event_type: str,
        run_id: str,
        parent_run_id: Optional[str] = None,
        **extra: Any,
    ) -> Dict[str, Any]:
        """Create a structured event dict."""
        event: Dict[str, Any] = {
            "event_id": str(uuid.uuid4()),
            "agent_id": self.agent_id,
            "event_type": event_type,
            "run_id": run_id,
            "parent_run_id": parent_run_id,
            "timestamp": self._now_iso(),
        }
        event.update(extra)
        return event

    def _redact_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Redact all values in a dictionary."""
        return {k: self.redactor.redact(v) for k, v in data.items()}

    def _redact_list(self, data: List[Any]) -> List[Any]:
        """Redact all items in a list."""
        return [self.redactor.redact(item) for item in data]

    def _record(self, event: Dict[str, Any]) -> str:
        """Record an event through storage. Returns event ID."""
        if self.verbose:
            print(f"[Lobster] {event['event_type']}: {event.get('run_id', 'N/A')}")
        return self.storage.record(event)

    # ─── Chain Callbacks ────────────────────────────────────────────

    def on_chain_start(
        self,
        serialized: Dict[str, Any],
        inputs: Dict[str, Any],
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        """Record the start of a chain execution."""
        if not self.record_chain:
            return

        run_id_str = str(run_id)
        self._start_times[run_id_str] = time.monotonic()

        chain_name = serialized.get("name", serialized.get("id", ["unknown"])[-1])
        if isinstance(chain_name, list):
            chain_name = chain_name[-1] if chain_name else "unknown"

        event = self._make_event(
            event_type="chain_start",
            run_id=run_id_str,
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            chain_name=chain_name,
            inputs=self.redactor.redact(inputs),
            tags=tags or [],
            metadata=self._redact_dict(metadata) if metadata else {},
        )
        self._record(event)

    def on_chain_end(
        self,
        outputs: Dict[str, Any],
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Record the end of a chain execution."""
        if not self.record_chain:
            return

        run_id_str = str(run_id)
        start = self._start_times.pop(run_id_str, None)
        duration_ms = int((time.monotonic() - start) * 1000) if start else None

        event = self._make_event(
            event_type="chain_end",
            run_id=run_id_str,
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            outputs=self.redactor.redact(outputs),
            duration_ms=duration_ms,
        )
        self._record(event)

    def on_chain_error(
        self,
        error: Union[Exception, KeyboardInterrupt],
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Record a chain execution error."""
        if not self.record_chain:
            return

        run_id_str = str(run_id)
        start = self._start_times.pop(run_id_str, None)
        duration_ms = int((time.monotonic() - start) * 1000) if start else None

        event = self._make_event(
            event_type="chain_error",
            run_id=run_id_str,
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            error_type=type(error).__name__,
            error_message=self.redactor.redact(str(error)),
            duration_ms=duration_ms,
        )
        self._record(event)

    # ─── Tool Callbacks ─────────────────────────────────────────────

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        inputs: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        """Record the start of a tool call."""
        if not self.record_tool:
            return

        run_id_str = str(run_id)
        self._start_times[run_id_str] = time.monotonic()

        tool_name = serialized.get("name", serialized.get("id", ["unknown"])[-1])
        if isinstance(tool_name, list):
            tool_name = tool_name[-1] if tool_name else "unknown"

        event = self._make_event(
            event_type="tool_start",
            run_id=run_id_str,
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            tool_name=tool_name,
            input=self.redactor.redact(input_str),
            tags=tags or [],
            metadata=self._redact_dict(metadata) if metadata else {},
        )
        self._record(event)

    def on_tool_end(
        self,
        output: str,
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Record the end of a tool call."""
        if not self.record_tool:
            return

        run_id_str = str(run_id)
        start = self._start_times.pop(run_id_str, None)
        duration_ms = int((time.monotonic() - start) * 1000) if start else None

        event = self._make_event(
            event_type="tool_end",
            run_id=run_id_str,
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            output=self.redactor.redact(output),
            duration_ms=duration_ms,
        )
        self._record(event)

    def on_tool_error(
        self,
        error: Union[Exception, KeyboardInterrupt],
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Record a tool call error."""
        if not self.record_tool:
            return

        run_id_str = str(run_id)
        start = self._start_times.pop(run_id_str, None)
        duration_ms = int((time.monotonic() - start) * 1000) if start else None

        event = self._make_event(
            event_type="tool_error",
            run_id=run_id_str,
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            error_type=type(error).__name__,
            error_message=self.redactor.redact(str(error)),
            duration_ms=duration_ms,
        )
        self._record(event)

    # ─── LLM Callbacks ─────────────────────────────────────────────

    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        invocation_params: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        """Record the start of an LLM call."""
        if not self.record_llm:
            return

        run_id_str = str(run_id)
        self._start_times[run_id_str] = time.monotonic()

        model_name = "unknown"
        if invocation_params:
            model_name = invocation_params.get(
                "model_name",
                invocation_params.get("model", "unknown"),
            )
        else:
            model_name = serialized.get("name", serialized.get("id", ["unknown"])[-1])
            if isinstance(model_name, list):
                model_name = model_name[-1] if model_name else "unknown"

        event = self._make_event(
            event_type="llm_start",
            run_id=run_id_str,
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            model=model_name,
            prompts=self._redact_list(prompts),
            tags=tags or [],
            metadata=self._redact_dict(metadata) if metadata else {},
            invocation_params=self._redact_dict(invocation_params) if invocation_params else {},
        )
        self._record(event)

    def on_llm_end(
        self,
        response: LLMResult,
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Record the end of an LLM call."""
        if not self.record_llm:
            return

        run_id_str = str(run_id)
        start = self._start_times.pop(run_id_str, None)
        duration_ms = int((time.monotonic() - start) * 1000) if start else None

        # Extract token usage from LLMResult
        token_usage: Dict[str, Any] = {}
        if response.llm_output:
            token_usage = response.llm_output.get("token_usage", {})
            token_usage = self._redact_dict(token_usage)

        # Extract generations summary
        generations_summary: List[Dict[str, Any]] = []
        for gen_list in response.generations:
            for gen in gen_list:
                gen_info: Dict[str, Any] = {
                    "text": self.redactor.redact(gen.text),
                    "type": type(gen).__name__,
                }
                if hasattr(gen, "generation_info") and gen.generation_info:
                    gen_info["finish_reason"] = gen.generation_info.get("finish_reason")
                generations_summary.append(gen_info)

        event = self._make_event(
            event_type="llm_end",
            run_id=run_id_str,
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            token_usage=token_usage,
            generations=generations_summary,
            duration_ms=duration_ms,
        )
        self._record(event)

    def on_llm_error(
        self,
        error: Union[Exception, KeyboardInterrupt],
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Record an LLM call error."""
        if not self.record_llm:
            return

        run_id_str = str(run_id)
        start = self._start_times.pop(run_id_str, None)
        duration_ms = int((time.monotonic() - start) * 1000) if start else None

        event = self._make_event(
            event_type="llm_error",
            run_id=run_id_str,
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            error_type=type(error).__name__,
            error_message=self.redactor.redact(str(error)),
            duration_ms=duration_ms,
        )
        self._record(event)

    # ─── Agent Callbacks ────────────────────────────────────────────

    def on_agent_action(
        self,
        action: AgentAction,
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Record an agent action (decision to use a tool)."""
        if not self.record_agent:
            return

        event = self._make_event(
            event_type="agent_action",
            run_id=str(run_id),
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            tool=action.tool,
            tool_input=self.redactor.redact(action.tool_input),
            log=self.redactor.redact(action.log),
        )
        self._record(event)

    def on_agent_finish(
        self,
        finish: AgentFinish,
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Record agent completion."""
        if not self.record_agent:
            return

        event = self._make_event(
            event_type="agent_finish",
            run_id=str(run_id),
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            return_values=self.redactor.redact(finish.return_values),
            log=self.redactor.redact(finish.log),
        )
        self._record(event)

    # ─── Retriever Callbacks ────────────────────────────────────────

    def on_retriever_start(
        self,
        serialized: Dict[str, Any],
        query: str,
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        """Record retriever start."""
        event = self._make_event(
            event_type="retriever_start",
            run_id=str(run_id),
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            query=self.redactor.redact(query),
        )
        self._record(event)

    def on_retriever_end(
        self,
        documents: List[Document],
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Record retriever end with document count."""
        event = self._make_event(
            event_type="retriever_end",
            run_id=str(run_id),
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            num_documents=len(documents),
        )
        self._record(event)

    def on_retriever_error(
        self,
        error: Union[Exception, KeyboardInterrupt],
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Record retriever error."""
        event = self._make_event(
            event_type="retriever_error",
            run_id=str(run_id),
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            error_type=type(error).__name__,
            error_message=self.redactor.redact(str(error)),
        )
        self._record(event)

    # ─── Chat Model Callbacks ──────────────────────────────────────

    def on_chat_model_start(
        self,
        serialized: Dict[str, Any],
        messages: List[Any],
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        invocation_params: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        """Record chat model start."""
        if not self.record_llm:
            return

        run_id_str = str(run_id)
        self._start_times[run_id_str] = time.monotonic()

        model_name = "unknown"
        if invocation_params:
            model_name = invocation_params.get(
                "model_name",
                invocation_params.get("model", "unknown"),
            )

        # Serialize messages (redacted)
        serialized_messages = []
        for msg_list in messages:
            for msg in msg_list:
                msg_dict = {
                    "type": getattr(msg, "type", type(msg).__name__),
                    "content": self.redactor.redact(getattr(msg, "content", "")),
                }
                serialized_messages.append(msg_dict)

        event = self._make_event(
            event_type="chat_model_start",
            run_id=run_id_str,
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            model=model_name,
            messages=serialized_messages,
        )
        self._record(event)

    def on_chat_model_end(
        self,
        response: ChatResult,
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Record chat model end."""
        if not self.record_llm:
            return

        run_id_str = str(run_id)
        start = self._start_times.pop(run_id_str, None)
        duration_ms = int((time.monotonic() - start) * 1000) if start else None

        event = self._make_event(
            event_type="chat_model_end",
            run_id=run_id_str,
            parent_run_id=str(parent_run_id) if parent_run_id else None,
            duration_ms=duration_ms,
        )
        self._record(event)
