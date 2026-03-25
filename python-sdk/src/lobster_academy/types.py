"""Core data types for Lobster Academy.

Defines the primary data structures used across all modules:
RecordEvent, ToolCall, EvaluationResult, and AttackResult.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


# Valid event types for RecordEvent
VALID_EVENT_TYPES: frozenset[str] = frozenset({
    "inference", "tool_call", "error", "system", "user_input",
})

# Valid severity levels for AttackResult
VALID_SEVERITIES: frozenset[str] = frozenset({
    "low", "medium", "high", "critical",
})

# Valid grade values
VALID_GRADES: frozenset[str] = frozenset({"A", "B", "C", "D", "F"})


@dataclass
class ToolCall:
    """Represents a single tool invocation by an agent.

    Attributes:
        name: Name of the tool invoked.
        params: Parameters passed to the tool.
        result: Result returned by the tool (None if failed).
        duration: Execution time in seconds.
    """

    name: str
    params: dict[str, Any] = field(default_factory=dict)
    result: Any = None
    duration: float = 0.0


@dataclass
class RecordEvent:
    """A single recorded agent event.

    Attributes:
        type: Event type (inference, tool_call, error, etc.).
        input: Input text provided to the agent.
        reasoning: Agent's reasoning trace.
        output: Agent's output text.
        tool_calls: List of tool invocations in this event.
        timestamp: ISO 8601 timestamp of the event.
        signature: Ed25519 signature bytes for integrity verification.
        event_id: Unique UUID for this event.
    """

    type: str = "inference"
    input: str = ""
    reasoning: str = ""
    output: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    signature: bytes = b""
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_dict(self) -> dict[str, Any]:
        """Convert event to a JSON-serializable dictionary.

        Returns:
            Dictionary representation with all fields, signature as hex string.
        """
        return {
            "event_id": self.event_id,
            "type": self.type,
            "input": self.input,
            "reasoning": self.reasoning,
            "output": self.output,
            "tool_calls": [
                {
                    "name": tc.name,
                    "params": tc.params,
                    "result": tc.result,
                    "duration": tc.duration,
                }
                for tc in self.tool_calls
            ],
            "timestamp": self.timestamp,
            "signature": self.signature.hex() if self.signature else "",
        }


@dataclass
class EvaluationResult:
    """Result of an agent behavior evaluation.

    Attributes:
        total_score: Overall score from 0 to 100.
        grade: Letter grade (A/B/C/D/F).
        dimensions: Per-dimension scores and metrics.
    """

    total_score: float = 0.0
    grade: str = "F"
    dimensions: dict[str, dict[str, Any]] = field(default_factory=dict)

    @staticmethod
    def grade_from_score(score: float) -> str:
        """Convert a numeric score to a letter grade.

        Args:
            score: Numeric score (0-100).

        Returns:
            Letter grade string (A/B/C/D/F).

        Raises:
            ValueError: If score is not between 0 and 100.
        """
        if not 0 <= score <= 100:
            raise ValueError(f"Score must be between 0 and 100, got {score}")
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"


@dataclass
class AttackResult:
    """Result of a single adversarial attack scenario.

    Attributes:
        scenario: Name/ID of the attack scenario.
        passed: True if the agent successfully resisted the attack.
        severity: Severity level (low/medium/high/critical).
        evidence: Description of what happened during the attack.
    """

    scenario: str = ""
    passed: bool = False
    severity: str = "medium"
    evidence: str = ""
