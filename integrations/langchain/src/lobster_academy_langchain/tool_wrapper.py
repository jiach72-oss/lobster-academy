"""LobsterToolWrapper: Wraps LangChain Tools with automatic behavior recording.

Provides transparent wrapping of LangChain Tool instances to capture
tool invocations, parameters, and results with automatic PII redaction.
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Union

from langchain.tools import BaseTool, Tool, StructuredTool
from langchain.callbacks.manager import CallbackManagerForToolRun
from pydantic import BaseModel, Field

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


class LobsterToolWrapper:
    """Wraps LangChain Tools to automatically record behavior evidence.

    This wrapper intercepts tool calls, records the input/output with
    timing information, and passes all data through a Redactor for
    PII removal before storage.

    Usage:
        # Wrap an existing tool
        search_tool = DuckDuckGoSearchRun()
        wrapped = LobsterToolWrapper.wrap(search_tool)

        # Wrap with custom config
        wrapper = LobsterToolWrapper(
            agent_id="my-agent",
            redactor=my_redactor,
            storage=my_storage,
        )
        wrapped = wrapper.wrap(search_tool)
    """

    def __init__(
        self,
        agent_id: Optional[str] = None,
        redactor: Optional[Redactor] = None,
        storage: Optional[Storage] = None,
    ) -> None:
        self.agent_id = agent_id or f"agent_{uuid.uuid4().hex[:12]}"
        self.redactor = redactor or Redactor()
        self.storage = storage or Storage()

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _record(
        self,
        event_type: str,
        tool_name: str,
        **extra: Any,
    ) -> str:
        """Record a tool-related event."""
        event = {
            "event_id": str(uuid.uuid4()),
            "agent_id": self.agent_id,
            "event_type": event_type,
            "tool_name": tool_name,
            "timestamp": self._now_iso(),
            **extra,
        }
        return self.storage.record(event)

    def wrap(self, tool: BaseTool) -> BaseTool:
        """Wrap a LangChain BaseTool with behavior recording.

        Args:
            tool: A LangChain BaseTool instance to wrap.

        Returns:
            A new tool instance with recording capabilities.
        """
        original_run = tool._run
        wrapper = self

        class WrappedTool(tool.__class__):
            """Dynamically wrapped tool with Lobster recording."""

            def _run(
                self,
                tool_input: Union[str, Dict[str, Any]],
                run_manager: Optional[CallbackManagerForToolRun] = None,
            ) -> str:
                start_time = time.monotonic()

                # Record tool call start
                wrapper._record(
                    event_type="toolCallStart",
                    tool_name=tool.name,
                    input=wrapper.redactor.redact(tool_input),
                    description=tool.description,
                )

                try:
                    # Execute original tool
                    result = original_run(self, tool_input, run_manager)
                    duration_ms = int((time.monotonic() - start_time) * 1000)

                    # Record tool call success
                    wrapper._record(
                        event_type="toolCallEnd",
                        tool_name=tool.name,
                        output=wrapper.redactor.redact(result),
                        duration_ms=duration_ms,
                        success=True,
                    )
                    return result

                except Exception as e:
                    duration_ms = int((time.monotonic() - start_time) * 1000)

                    # Record tool call error
                    wrapper._record(
                        event_type="toolCallError",
                        tool_name=tool.name,
                        error_type=type(e).__name__,
                        error_message=wrapper.redactor.redact(str(e)),
                        duration_ms=duration_ms,
                        success=False,
                    )
                    raise

        # Preserve original tool metadata
        wrapped = WrappedTool(
            name=tool.name,
            description=tool.description,
            args_schema=tool.args_schema,
            return_direct=tool.return_direct,
            verbose=tool.verbose,
            callbacks=tool.callbacks,
            tags=tool.tags,
            metadata=tool.metadata,
        )
        return wrapped

    @classmethod
    def wrap_tool(
        cls,
        tool: BaseTool,
        agent_id: Optional[str] = None,
        redactor: Optional[Redactor] = None,
        storage: Optional[Storage] = None,
    ) -> BaseTool:
        """Convenience class method to wrap a single tool.

        Args:
            tool: The tool to wrap.
            agent_id: Optional agent identifier.
            redactor: Optional custom redactor.
            storage: Optional custom storage.

        Returns:
            Wrapped tool instance.
        """
        wrapper = cls(agent_id=agent_id, redactor=redactor, storage=storage)
        return wrapper.wrap(tool)

    @classmethod
    def wrap_tools(
        cls,
        tools: List[BaseTool],
        agent_id: Optional[str] = None,
        redactor: Optional[Redactor] = None,
        storage: Optional[Storage] = None,
    ) -> List[BaseTool]:
        """Wrap a list of tools with shared configuration.

        Args:
            tools: List of tools to wrap.
            agent_id: Optional agent identifier.
            redactor: Optional custom redactor.
            storage: Optional custom storage.

        Returns:
            List of wrapped tool instances.
        """
        wrapper = cls(agent_id=agent_id, redactor=redactor, storage=storage)
        return [wrapper.wrap(tool) for tool in tools]


def wrap_tool_function(
    func: Callable[..., str],
    name: str,
    description: str,
    agent_id: Optional[str] = None,
    redactor: Optional[Redactor] = None,
    storage: Optional[Storage] = None,
) -> BaseTool:
    """Create a wrapped LangChain Tool from a plain function.

    This is a convenience function that creates a LangChain Tool from
    a function and wraps it with LobsterToolWrapper.

    Args:
        func: The function to wrap. Must accept a string and return a string.
        name: Tool name for display and logging.
        description: Tool description for the agent.
        agent_id: Optional agent identifier.
        redactor: Optional custom redactor.
        storage: Optional custom storage.

    Returns:
        A wrapped BaseTool instance.

    Example:
        def search(query: str) -> str:
            return f"Results for: {query}"

        tool = wrap_tool_function(
            func=search,
            name="search",
            description="Search the web",
        )
    """
    base_tool = Tool(
        name=name,
        description=description,
        func=func,
    )
    wrapper = LobsterToolWrapper(
        agent_id=agent_id,
        redactor=redactor,
        storage=storage,
    )
    return wrapper.wrap(base_tool)
