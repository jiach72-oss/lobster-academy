"""ClickHouse storage adapter for Lobster Academy.

Optimized for high-throughput event ingestion and aggregation queries.
Requires: pip install clickhouse-driver
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from ..recorder import StorageBackend
from ..types import RecordEvent, ToolCall

logger = logging.getLogger(__name__)

try:
    from clickhouse_driver import Client  # type: ignore[import-untyped]
except ImportError:
    Client = None  # type: ignore[assignment,misc]

# Regex for valid SQL identifiers (alphanumeric + underscore, must start with letter/underscore)
_VALID_IDENTIFIER = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')

# Maximum identifier length
_MAX_IDENTIFIER_LENGTH = 128


def _validate_identifier(name: str, kind: str = "identifier") -> str:
    """Validate a SQL identifier (database/table name) to prevent injection.

    Args:
        name: The identifier to validate.
        kind: Description of the identifier for error messages.

    Returns:
        The validated identifier.

    Raises:
        ValueError: If the identifier contains unsafe characters or is too long.
    """
    if not name or not _VALID_IDENTIFIER.match(name):
        raise ValueError(
            f"Invalid {kind} '{name}': must match ^[A-Za-z_][A-Za-z0-9_]*$"
        )
    if len(name) > _MAX_IDENTIFIER_LENGTH:
        raise ValueError(
            f"Invalid {kind} '{name}': exceeds maximum length of {_MAX_IDENTIFIER_LENGTH}"
        )
    return name


class ClickHouseStorage(StorageBackend):
    """ClickHouse-backed event storage for high-throughput scenarios.

    Args:
        host: ClickHouse server host.
        port: ClickHouse server port.
        database: Database name.
        table: Table name for events.
        user: Authentication user.
        password: Authentication password.
        **kwargs: Additional kwargs for clickhouse-driver.

    Raises:
        ImportError: If clickhouse-driver is not installed.

    Example:
        >>> storage = ClickHouseStorage("localhost", database="lobster_academy")
        >>> storage.save("agent-001", event)
        >>> stats = storage.aggregate_by_type("agent-001")
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 9000,
        database: str = "lobster_academy",
        table: str = "agent_events",
        user: str = "default",
        *,
        password: str,
        **kwargs: Any,
    ) -> None:
        if Client is None:
            raise ImportError(
                "clickhouse-driver is required for ClickHouse storage. "
                "Install it with: pip install clickhouse-driver"
            )

        self._database = _validate_identifier(database, "database")
        self._table = _validate_identifier(table, "table")
        self._client = Client(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password,
            **kwargs,
        )
        self._ensure_table()
        logger.info(
            "ClickHouseStorage initialized: %s.%s on %s:%d",
            self._database,
            self._table,
            host,
            port,
        )

    def _ensure_table(self) -> None:
        """Create table if it doesn't exist."""
        self._client.execute(f"""
            CREATE TABLE IF NOT EXISTS {self._database}.{self._table} (
                event_id String,
                agent_id String,
                event_type LowCardinality(String),
                input String,
                reasoning String,
                output String,
                tool_calls String DEFAULT '[]',
                timestamp DateTime64(3, 'UTC'),
                signature String,
                created_at DateTime64(3, 'UTC') DEFAULT now64(3)
            )
            ENGINE = MergeTree()
            PARTITION BY toYYYYMM(timestamp)
            ORDER BY (agent_id, event_type, timestamp)
            TTL toDateTime(timestamp) + INTERVAL 365 DAY
        """)

    def _event_to_row(self, agent_id: str, event: RecordEvent) -> dict[str, Any]:
        """Convert RecordEvent to ClickHouse row.

        Args:
            agent_id: Agent identifier.
            event: RecordEvent to convert.

        Returns:
            Dictionary suitable for ClickHouse INSERT.
        """
        ts = event.timestamp
        if ts:
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except ValueError:
                dt = datetime.now(timezone.utc)
        else:
            dt = datetime.now(timezone.utc)

        return {
            "event_id": event.event_id,
            "agent_id": agent_id,
            "event_type": event.type,
            "input": event.input,
            "reasoning": event.reasoning,
            "output": event.output,
            "tool_calls": json.dumps([
                {
                    "name": tc.name,
                    "params": tc.params,
                    "result": tc.result,
                    "duration": tc.duration,
                }
                for tc in event.tool_calls
            ]),
            "timestamp": dt,
            "signature": event.signature.hex() if event.signature else "",
        }

    def _row_to_event(self, row: tuple[Any, ...]) -> RecordEvent:
        """Convert ClickHouse row tuple to RecordEvent.

        Args:
            row: Row tuple from ClickHouse SELECT.

        Returns:
            RecordEvent instance.
        """
        tc_data = json.loads(row[6]) if row[6] else []
        tool_calls = [
            ToolCall(
                name=tc["name"],
                params=tc.get("params", {}),
                result=tc.get("result"),
                duration=tc.get("duration", 0.0),
            )
            for tc in tc_data
        ]
        ts = row[7]
        timestamp_str = ts.isoformat() if isinstance(ts, datetime) else str(ts)

        return RecordEvent(
            event_id=row[0],
            type=row[2],
            input=row[3],
            reasoning=row[4],
            output=row[5],
            tool_calls=tool_calls,
            timestamp=timestamp_str,
            signature=bytes.fromhex(row[8]) if row[8] else b"",
        )

    def _ensure_event_id(self, event: RecordEvent) -> None:
        """Ensure event has an ID and timestamp."""
        if not event.event_id:
            event.event_id = str(uuid.uuid4())
        if not event.timestamp:
            event.timestamp = datetime.now(timezone.utc).isoformat()

    def save(self, agent_id: str, event: RecordEvent) -> str:
        """Save a single event to ClickHouse.

        Args:
            agent_id: Agent identifier.
            event: Event to save.

        Returns:
            The event ID.
        """
        self._ensure_event_id(event)
        row = self._event_to_row(agent_id, event)
        columns = list(row.keys())
        self._client.execute(
            f"INSERT INTO {self._database}.{self._table} ({', '.join(columns)}) VALUES",
            [tuple(row[c] for c in columns)],
        )
        logger.debug("Saved event %s to ClickHouse", event.event_id)
        return event.event_id

    def save_batch(self, agent_id: str, events: list[RecordEvent]) -> list[str]:
        """Batch save multiple events for high throughput.

        Args:
            agent_id: Agent identifier.
            events: List of events to save.

        Returns:
            List of event IDs.
        """
        if not events:
            return []

        rows = []
        event_ids = []
        for event in events:
            self._ensure_event_id(event)
            rows.append(self._event_to_row(agent_id, event))
            event_ids.append(event.event_id)

        columns = list(rows[0].keys())
        self._client.execute(
            f"INSERT INTO {self._database}.{self._table} ({', '.join(columns)}) VALUES",
            [tuple(row[c] for c in columns) for row in rows],
        )
        logger.info("Batch saved %d events to ClickHouse", len(events))
        return event_ids

    def get_events(self, agent_id: str) -> list[RecordEvent]:
        """Get all events for an agent.

        Args:
            agent_id: Agent identifier.

        Returns:
            List of events sorted by timestamp.
        """
        result = self._client.execute(
            f"SELECT * FROM {self._database}.{self._table} "
            f"WHERE agent_id = %(agent_id)s ORDER BY timestamp",
            {"agent_id": agent_id},
        )
        return [self._row_to_event(row) for row in result]

    def get_events_by_type(self, agent_id: str, event_type: str) -> list[RecordEvent]:
        """Get events filtered by type.

        Args:
            agent_id: Agent identifier.
            event_type: Event type to filter by.

        Returns:
            List of matching events.
        """
        result = self._client.execute(
            f"SELECT * FROM {self._database}.{self._table} "
            f"WHERE agent_id = %(agent_id)s AND event_type = %(event_type)s "
            f"ORDER BY timestamp",
            {"agent_id": agent_id, "event_type": event_type},
        )
        return [self._row_to_event(row) for row in result]

    def get_events_by_time(
        self, agent_id: str, start: str, end: str
    ) -> list[RecordEvent]:
        """Get events within a time range.

        Args:
            agent_id: Agent identifier.
            start: Start timestamp (ISO 8601).
            end: End timestamp (ISO 8601).

        Returns:
            List of events within the time range.
        """
        result = self._client.execute(
            f"SELECT * FROM {self._database}.{self._table} "
            f"WHERE agent_id = %(agent_id)s "
            f"AND timestamp >= %(start)s AND timestamp <= %(end)s "
            f"ORDER BY timestamp",
            {"agent_id": agent_id, "start": start, "end": end},
        )
        return [self._row_to_event(row) for row in result]

    def aggregate_by_type(self, agent_id: str) -> list[dict[str, Any]]:
        """Aggregate event counts by type for an agent.

        Args:
            agent_id: Agent identifier.

        Returns:
            List of dicts with event_type, count, first_seen, last_seen.
        """
        result = self._client.execute(
            f"SELECT event_type, count() as cnt, "
            f"min(timestamp) as first_seen, max(timestamp) as last_seen "
            f"FROM {self._database}.{self._table} "
            f"WHERE agent_id = %(agent_id)s GROUP BY event_type "
            f"ORDER BY cnt DESC",
            {"agent_id": agent_id},
        )
        return [
            {
                "event_type": row[0],
                "count": row[1],
                "first_seen": row[2].isoformat() if row[2] else None,
                "last_seen": row[3].isoformat() if row[3] else None,
            }
            for row in result
        ]

    def aggregate_by_hour(self, agent_id: str, days: int = 7) -> list[dict[str, Any]]:
        """Aggregate event counts by hour for trending analysis.

        Args:
            agent_id: Agent identifier.
            days: Number of days to look back.

        Returns:
            List of dicts with hour and count.
        """
        result = self._client.execute(
            f"SELECT toStartOfHour(timestamp) as hour, "
            f"count() as cnt "
            f"FROM {self._database}.{self._table} "
            f"WHERE agent_id = %(agent_id)s "
            f"AND timestamp >= now() - INTERVAL %(days)s DAY "
            f"GROUP BY hour ORDER BY hour",
            {"agent_id": agent_id, "days": days},
        )
        return [
            {
                "hour": row[0].isoformat() if row[0] else None,
                "count": row[1],
            }
            for row in result
        ]

    def clear(self, agent_id: str | None = None) -> None:
        """Clear events. If agent_id is provided, only clear that agent's events.

        Args:
            agent_id: Optional agent identifier to filter deletion.
        """
        if agent_id:
            self._client.execute(
                f"ALTER TABLE {self._database}.{self._table} "
                f"DELETE WHERE agent_id = %(agent_id)s",
                {"agent_id": agent_id},
            )
        else:
            self._client.execute(f"TRUNCATE TABLE {self._database}.{self._table}")
        logger.info("Cleared ClickHouse events%s", f" for {agent_id}" if agent_id else "")

    def count(self, agent_id: str | None = None) -> int:
        """Count events, optionally filtered by agent.

        Args:
            agent_id: Optional agent identifier to filter count.

        Returns:
            Number of events.
        """
        if agent_id:
            result = self._client.execute(
                f"SELECT count() FROM {self._database}.{self._table} "
                f"WHERE agent_id = %(agent_id)s",
                {"agent_id": agent_id},
            )
        else:
            result = self._client.execute(
                f"SELECT count() FROM {self._database}.{self._table}"
            )
        return result[0][0] if result else 0

    @property
    def is_connected(self) -> bool:
        """Check if ClickHouse is reachable.

        Returns:
            True if connection succeeds, False otherwise.
        """
        try:
            self._client.execute("SELECT 1")
            return True
        except Exception:
            return False
