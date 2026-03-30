"""Recorder - Agent event recording and replay.

Stores agent events in memory or PostgreSQL for audit trails.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Protocol, runtime_checkable

from .exceptions import RecordingError
from .types import RecordEvent, ToolCall

logger = logging.getLogger(__name__)


@runtime_checkable
class StorageBackend(Protocol):
    """Protocol for pluggable storage backends."""

    def save(self, agent_id: str, event: RecordEvent) -> str: ...
    def get_events(self, agent_id: str) -> list[RecordEvent]: ...


class MemoryStorage:
    """In-memory event storage.

    Simple dict-based storage suitable for testing and short-lived sessions.
    """

    def __init__(self) -> None:
        self._store: dict[str, list[RecordEvent]] = {}

    def save(self, agent_id: str, event: RecordEvent) -> str:
        """Save an event to in-memory store.

        Args:
            agent_id: Agent identifier (must be non-empty).
            event: Event to store.

        Returns:
            The event ID.

        Raises:
            ValueError: If agent_id is empty.
        """
        if not agent_id:
            raise ValueError("agent_id must not be empty")
        if agent_id not in self._store:
            self._store[agent_id] = []
        self._store[agent_id].append(event)
        logger.debug("MemoryStorage: saved event %s for agent %s", event.event_id, agent_id)
        return event.event_id

    def get_events(self, agent_id: str) -> list[RecordEvent]:
        """Get all events for an agent.

        Args:
            agent_id: Agent identifier (must be non-empty).

        Returns:
            Copy of the event list for the agent.

        Raises:
            ValueError: If agent_id is empty.
        """
        if not agent_id:
            raise ValueError("agent_id must not be empty")
        events = list(self._store.get(agent_id, []))
        logger.debug("MemoryStorage: retrieved %d events for agent %s", len(events), agent_id)
        return events


class PostgreSQLStorage:
    """PostgreSQL-backed event storage.

    Args:
        dsn: PostgreSQL connection string (e.g., postgresql://user:pass@host/db).

    Raises:
        ImportError: If psycopg2 is not installed.
        RecordingError: If connection or table creation fails.
    """

    def __init__(self, dsn: str) -> None:
        if not dsn:
            raise ValueError("DSN must not be empty")
        self.dsn = dsn
        self._conn = None
        self._ensure_connection()

    def _ensure_connection(self) -> None:
        """Establish database connection and create table if needed."""
        try:
            import psycopg2  # type: ignore[import-untyped]
            self._conn = psycopg2.connect(self.dsn)
            self._create_table()
            logger.info("PostgreSQL connection established")
        except ImportError:
            raise ImportError(
                "psycopg2 is required for PostgreSQL storage. "
                "Install it with: pip install psycopg2-binary"
            )
        except Exception as e:
            raise RecordingError(f"Failed to connect to PostgreSQL: {e}") from e

    def _create_table(self) -> None:
        """Create the agent_events table if it doesn't exist."""
        if self._conn is None:
            raise RecordingError("No database connection")
        try:
            with self._conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS agent_events (
                        event_id TEXT PRIMARY KEY,
                        agent_id TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        input TEXT,
                        reasoning TEXT,
                        output TEXT,
                        tool_calls JSONB DEFAULT '[]',
                        timestamp TIMESTAMPTZ,
                        signature TEXT,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """)
                self._conn.commit()
        except Exception as e:
            raise RecordingError(f"Failed to create table: {e}") from e

    def save(self, agent_id: str, event: RecordEvent) -> str:
        """Save an event to PostgreSQL.

        Args:
            agent_id: Agent identifier (must be non-empty).
            event: Event to store.

        Returns:
            The event ID.

        Raises:
            ValueError: If agent_id is empty.
            RecordingError: If the insert fails.
        """
        if not agent_id:
            raise ValueError("agent_id must not be empty")
        if self._conn is None:
            raise RecordingError("No database connection")
        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO agent_events
                        (event_id, agent_id, event_type, input, reasoning,
                         output, tool_calls, timestamp, signature)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        event.event_id,
                        agent_id,
                        event.type,
                        event.input,
                        event.reasoning,
                        event.output,
                        json.dumps([
                            {
                                "name": tc.name,
                                "params": tc.params,
                                "result": tc.result,
                                "duration": tc.duration,
                            }
                            for tc in event.tool_calls
                        ]),
                        event.timestamp,
                        event.signature.hex(),
                    ),
                )
                self._conn.commit()
            logger.debug("Saved event %s for agent %s", event.event_id, agent_id)
            return event.event_id
        except Exception as e:
            raise RecordingError(f"Failed to save event: {e}") from e

    def get_events(self, agent_id: str) -> list[RecordEvent]:
        """Get all events for an agent.

        Args:
            agent_id: Agent identifier (must be non-empty).

        Returns:
            List of events sorted by timestamp.

        Raises:
            ValueError: If agent_id is empty.
            RecordingError: If the query fails.
        """
        if not agent_id:
            raise ValueError("agent_id must not be empty")
        if self._conn is None:
            raise RecordingError("No database connection")
        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    "SELECT event_id, event_type, input, reasoning, output, "
                    "tool_calls, timestamp, signature "
                    "FROM agent_events WHERE agent_id = %s ORDER BY timestamp",
                    (agent_id,),
                )
                rows = cur.fetchall()

            events: list[RecordEvent] = []
            for row in rows:
                tc_data = json.loads(row[5]) if row[5] else []
                tool_calls = [
                    ToolCall(
                        name=tc["name"],
                        params=tc.get("params", {}),
                        result=tc.get("result"),
                        duration=tc.get("duration", 0.0),
                    )
                    for tc in tc_data
                ]
                event = RecordEvent(
                    event_id=row[0],
                    type=row[1],
                    input=row[2] or "",
                    reasoning=row[3] or "",
                    output=row[4] or "",
                    tool_calls=tool_calls,
                    timestamp=row[6].isoformat() if row[6] else "",
                    signature=bytes.fromhex(row[7]) if row[7] else b"",
                )
                events.append(event)
            logger.debug("PostgreSQLStorage: retrieved %d events for agent %s", len(events), agent_id)
            return events
        except Exception as e:
            raise RecordingError(f"Failed to get events: {e}") from e


class Recorder:
    """Records agent events for audit and replay.

    Args:
        agent_id: Unique identifier for the agent being recorded.
        storage: Optional storage backend. Defaults to MemoryStorage.

    Raises:
        ValueError: If agent_id is empty.

    Example:
        >>> recorder = Recorder("my-agent-001")
        >>> event = RecordEvent(type="inference", input="hello", output="world")
        >>> recorder.record(event)
        '...'
        >>> events = recorder.replay()
    """

    def __init__(self, agent_id: str, storage: StorageBackend | None = None) -> None:
        if not agent_id:
            raise ValueError("agent_id must not be empty")
        self.agent_id = agent_id
        self._storage: StorageBackend = storage or MemoryStorage()
        logger.debug("Recorder initialized for agent %s", agent_id)

    def record(self, event: RecordEvent) -> str:
        """Record a single event.

        Args:
            event: The event to record.

        Returns:
            The event ID.

        Raises:
            RecordingError: If recording fails.
        """
        if not event.event_id:
            event.event_id = str(uuid.uuid4())
        if not event.timestamp:
            event.timestamp = datetime.now(timezone.utc).isoformat()
        result = self._storage.save(self.agent_id, event)
        logger.debug("Recorded event %s for agent %s", result, self.agent_id)
        return result

    def get_events(self) -> list[RecordEvent]:
        """Get all recorded events for this agent.

        Returns:
            List of events in insertion order.
        """
        return self._storage.get_events(self.agent_id)

    def replay(self) -> list[RecordEvent]:
        """Replay all events sorted by timestamp.

        Returns:
            List of events sorted chronologically.
        """
        events = self.get_events()
        return sorted(events, key=lambda e: e.timestamp)
