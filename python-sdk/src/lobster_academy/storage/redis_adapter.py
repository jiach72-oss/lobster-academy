"""Redis缓存层适配器 for Lobster Academy.

Real-time event stream cache with TTL expiration.
Suitable for hot-path event buffering and pub/sub streaming.
Requires: pip install redis
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from ..recorder import StorageBackend
from ..types import RecordEvent, ToolCall

try:
    import redis  # type: ignore[import-untyped]
except ImportError:
    redis = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


class RedisStorage(StorageBackend):
    """Redis-backed event cache for real-time streaming.

    Uses Redis Streams for ordered event storage with optional TTL.
    Supports pub/sub for real-time event notifications.

    Args:
        host: Redis server host.
        port: Redis server port.
        db: Redis database number.
        password: Redis password.
        key_prefix: Prefix for all Redis keys.
        ttl_seconds: Default TTL for events (0 = no expiry).
        max_stream_length: Max length for Redis Streams (0 = unlimited).
        **kwargs: Additional kwargs for redis-py.

    Example:
        >>> storage = RedisStorage("localhost", ttl_seconds=3600)
        >>> storage.save("agent-001", event)
        >>> events = storage.get_events("agent-001")
        >>> # Subscribe to real-time events
        >>> for event in storage.subscribe("agent-001"):
        ...     print(event)
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        db: int = 0,
        password: str | None = None,
        key_prefix: str = "lobster",
        ttl_seconds: int = 0,
        max_stream_length: int = 10000,
        **kwargs: Any,
    ) -> None:
        if redis is None:
            raise ImportError(
                "redis is required for Redis storage. "
                "Install it with: pip install redis"
            )

        self._redis = redis.Redis(
            host=host,
            port=port,
            db=db,
            password=password,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
            retry_on_timeout=True,
            **kwargs,
        )
        self._prefix = key_prefix.rstrip(":")
        self._ttl = ttl_seconds
        self._max_stream = max_stream_length

    def _stream_key(self, agent_id: str) -> str:
        """Generate Redis key for agent event stream."""
        return f"{self._prefix}:events:{agent_id}"

    def _counter_key(self, agent_id: str) -> str:
        """Generate Redis key for event counter."""
        return f"{self._prefix}:counter:{agent_id}"

    def _pubsub_channel(self, agent_id: str) -> str:
        """Generate pub/sub channel name."""
        return f"{self._prefix}:notify:{agent_id}"

    def _event_to_dict(self, agent_id: str, event: RecordEvent) -> dict[str, str]:
        """Convert RecordEvent to flat string dict for Redis Stream."""
        return {
            "event_id": event.event_id,
            "agent_id": agent_id,
            "type": event.type,
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
            ], ensure_ascii=False),
            "timestamp": event.timestamp,
            "signature": event.signature.hex() if event.signature else "",
        }

    def _dict_to_event(self, data: dict[str, str]) -> RecordEvent:
        """Convert Redis hash back to RecordEvent."""
        tc_data = json.loads(data.get("tool_calls", "[]"))
        tool_calls = [
            ToolCall(
                name=tc["name"],
                params=tc.get("params", {}),
                result=tc.get("result"),
                duration=tc.get("duration", 0.0),
            )
            for tc in tc_data
        ]
        return RecordEvent(
            event_id=data.get("event_id", ""),
            type=data.get("type", "inference"),
            input=data.get("input", ""),
            reasoning=data.get("reasoning", ""),
            output=data.get("output", ""),
            tool_calls=tool_calls,
            timestamp=data.get("timestamp", ""),
            signature=bytes.fromhex(data["signature"]) if data.get("signature") else b"",
        )

    def save(self, agent_id: str, event: RecordEvent) -> str:
        """Save event to Redis Stream with optional TTL."""
        if not event.event_id:
            import uuid
            event.event_id = str(uuid.uuid4())
        if not event.timestamp:
            event.timestamp = datetime.now(timezone.utc).isoformat()

        stream_key = self._stream_key(agent_id)
        fields = self._event_to_dict(agent_id, event)

        # Add to stream with max length trimming
        if self._max_stream > 0:
            self._redis.xadd(
                stream_key, fields,
                maxlen=self._max_stream,
                approximate=True,
            )
        else:
            self._redis.xadd(stream_key, fields)

        # Increment counter
        self._redis.incr(self._counter_key(agent_id))

        # Set TTL on stream
        if self._ttl > 0:
            self._redis.expire(stream_key, self._ttl)
            self._redis.expire(self._counter_key(agent_id), self._ttl)

        # Publish notification
        channel = self._pubsub_channel(agent_id)
        self._redis.publish(channel, json.dumps({
            "event_id": event.event_id,
            "type": event.type,
            "timestamp": event.timestamp,
        }))

        logger.debug(f"Saved event {event.event_id} to Redis stream")
        return event.event_id

    def get_events(self, agent_id: str) -> list[RecordEvent]:
        """Get all events from Redis Stream for an agent."""
        stream_key = self._stream_key(agent_id)
        entries = self._redis.xrange(stream_key, min="-", max="+")

        events = []
        for _entry_id, fields in entries:
            events.append(self._dict_to_event(fields))

        return events

    def get_events_range(
        self,
        agent_id: str,
        start: str = "-",
        end: str = "+",
        count: int | None = None,
    ) -> list[RecordEvent]:
        """Get events from a range of stream entry IDs.

        Args:
            agent_id: Agent identifier.
            start: Start entry ID ('-' for beginning).
            end: End entry ID ('+' for end).
            count: Max number of events to return.
        """
        stream_key = self._stream_key(agent_id)
        entries = self._redis.xrange(stream_key, min=start, max=end)

        events = []
        for _entry_id, fields in entries:
            events.append(self._dict_to_event(fields))
            if count and len(events) >= count:
                break

        return events

    def get_recent_events(self, agent_id: str, count: int = 100) -> list[RecordEvent]:
        """Get the most recent N events."""
        stream_key = self._stream_key(agent_id)
        entries = self._redis.xrevrange(stream_key, min="-", max="+", count=count)

        events = []
        for _entry_id, fields in entries:
            events.append(self._dict_to_event(fields))

        # Return in chronological order
        return list(reversed(events))

    def subscribe(self, agent_id: str, timeout: float = 0):
        """Subscribe to real-time events via pub/sub.

        Yields events as they arrive. Blocking generator.

        Args:
            agent_id: Agent identifier.
            timeout: Block timeout in seconds (0 = block forever).
        """
        pubsub = self._redis.pubsub()
        channel = self._pubsub_channel(agent_id)
        pubsub.subscribe(channel)

        try:
            for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    yield data
        finally:
            pubsub.unsubscribe(channel)
            pubsub.close()

    def set_ttl(self, agent_id: str, ttl_seconds: int) -> None:
        """Set TTL on an agent's event stream."""
        stream_key = self._stream_key(agent_id)
        counter_key = self._counter_key(agent_id)
        self._redis.expire(stream_key, ttl_seconds)
        self._redis.expire(counter_key, ttl_seconds)

    def get_ttl(self, agent_id: str) -> int:
        """Get remaining TTL on an agent's event stream (-1 = no expiry, -2 = key not found)."""
        stream_key = self._stream_key(agent_id)
        return self._redis.ttl(stream_key)

    def clear(self, agent_id: str | None = None) -> None:
        """Clear events. If agent_id is provided, only clear that agent's events."""
        if agent_id:
            keys = [
                self._stream_key(agent_id),
                self._counter_key(agent_id),
            ]
            self._redis.delete(*keys)
        else:
            # Delete all keys with our prefix
            pattern = f"{self._prefix}:*"
            cursor = 0
            while True:
                cursor, keys = self._redis.scan(cursor, match=pattern, count=100)
                if keys:
                    self._redis.delete(*keys)
                if cursor == 0:
                    break

        logger.info(f"Cleared Redis events{' for ' + agent_id if agent_id else ''}")

    def count(self, agent_id: str | None = None) -> int:
        """Count events for an agent."""
        if agent_id:
            stream_key = self._stream_key(agent_id)
            return self._redis.xlen(stream_key)
        else:
            # Count across all agent streams
            total = 0
            pattern = f"{self._prefix}:events:*"
            cursor = 0
            while True:
                cursor, keys = self._redis.scan(cursor, match=pattern, count=100)
                for key in keys:
                    total += self._redis.xlen(key)
                if cursor == 0:
                    break
            return total

    @property
    def is_connected(self) -> bool:
        """Check if Redis is reachable."""
        try:
            return self._redis.ping()
        except Exception:
            return False
