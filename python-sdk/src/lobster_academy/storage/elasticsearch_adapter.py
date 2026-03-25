"""Elasticsearch storage adapter for Lobster Academy.

Supports full-text search, time-range queries, and bulk writes.
Requires: pip install elasticsearch
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from ..recorder import StorageBackend
from ..types import RecordEvent, ToolCall

logger = logging.getLogger(__name__)

try:
    from elasticsearch import Elasticsearch  # type: ignore[import-untyped]
    from elasticsearch.helpers import bulk as es_bulk  # type: ignore[import-untyped]
except ImportError:
    Elasticsearch = None  # type: ignore[assignment,misc]
    es_bulk = None  # type: ignore[assignment]

# Default search result size
_DEFAULT_SEARCH_SIZE = 10000

# Default index settings
_INDEX_SHARDS = 1
_INDEX_REPLICAS = 0


class ElasticsearchStorage(StorageBackend):
    """Elasticsearch-backed event storage.

    Args:
        hosts: Elasticsearch host(s), e.g. ["http://localhost:9200"].
        index_prefix: Index name prefix. Events stored in {prefix}-{YYYY.MM}.
        bulk_size: Number of events to buffer before bulk flush.
        **kwargs: Additional kwargs passed to Elasticsearch client.

    Raises:
        ImportError: If elasticsearch is not installed.

    Example:
        >>> storage = ElasticsearchStorage(["http://localhost:9200"])
        >>> storage.save("agent-001", event)
        >>> events = storage.get_events("agent-001")
        >>> results = storage.search("error timeout", agent_id="agent-001")
    """

    def __init__(
        self,
        hosts: list[str],
        index_prefix: str = "lobster-events",
        bulk_size: int = 100,
        **kwargs: Any,
    ) -> None:
        if Elasticsearch is None:
            raise ImportError(
                "elasticsearch is required for Elasticsearch storage. "
                "Install it with: pip install elasticsearch"
            )

        self._es = Elasticsearch(hosts, **kwargs)
        self._index_prefix = index_prefix
        self._bulk_size = bulk_size
        self._buffer: list[dict[str, Any]] = []
        self._connected = False
        self._check_connection()
        logger.info(
            "ElasticsearchStorage initialized with prefix '%s'",
            index_prefix,
        )

    def _check_connection(self) -> None:
        """Check Elasticsearch connectivity."""
        try:
            self._connected = self._es.ping()
            if not self._connected:
                logger.warning(
                    "Elasticsearch ping failed, will retry on first operation"
                )
        except Exception as e:
            logger.warning("Elasticsearch connection check failed: %s", e)
            self._connected = False

    def _get_index_name(self, timestamp: str | None = None) -> str:
        """Generate monthly rolling index name.

        Args:
            timestamp: ISO 8601 timestamp; defaults to now.

        Returns:
            Index name in format {prefix}-{YYYY.MM}.
        """
        if timestamp:
            try:
                dt = datetime.fromisoformat(timestamp)
            except ValueError:
                dt = datetime.now(timezone.utc)
        else:
            dt = datetime.now(timezone.utc)
        return f"{self._index_prefix}-{dt.strftime('%Y.%m')}"

    def _ensure_index(self, index: str) -> None:
        """Create index with mapping if it doesn't exist.

        Args:
            index: Index name.
        """
        if not self._es.indices.exists(index=index):
            mapping = {
                "mappings": {
                    "properties": {
                        "event_id": {"type": "keyword"},
                        "agent_id": {"type": "keyword"},
                        "type": {"type": "keyword"},
                        "input": {"type": "text", "analyzer": "standard"},
                        "reasoning": {"type": "text", "analyzer": "standard"},
                        "output": {"type": "text", "analyzer": "standard"},
                        "tool_calls": {"type": "nested"},
                        "timestamp": {"type": "date"},
                        "signature": {"type": "keyword"},
                    }
                },
                "settings": {
                    "number_of_shards": _INDEX_SHARDS,
                    "number_of_replicas": _INDEX_REPLICAS,
                },
            }
            self._es.indices.create(index=index, body=mapping)
            logger.info("Created Elasticsearch index: %s", index)

    def _event_to_doc(self, agent_id: str, event: RecordEvent) -> dict[str, Any]:
        """Convert RecordEvent to Elasticsearch document.

        Args:
            agent_id: Agent identifier.
            event: Event to convert.

        Returns:
            Document dict for Elasticsearch.
        """
        return {
            "event_id": event.event_id,
            "agent_id": agent_id,
            "type": event.type,
            "input": event.input,
            "reasoning": event.reasoning,
            "output": event.output,
            "tool_calls": [
                {
                    "name": tc.name,
                    "params": tc.params,
                    "result": json.dumps(tc.result) if tc.result is not None else None,
                    "duration": tc.duration,
                }
                for tc in event.tool_calls
            ],
            "timestamp": event.timestamp,
            "signature": event.signature.hex() if event.signature else "",
        }

    def _doc_to_event(self, doc: dict[str, Any]) -> RecordEvent:
        """Convert Elasticsearch document to RecordEvent.

        Args:
            doc: Elasticsearch hit document.

        Returns:
            RecordEvent instance.
        """
        source = doc.get("_source", doc)
        tool_calls = [
            ToolCall(
                name=tc["name"],
                params=tc.get("params", {}),
                result=json.loads(tc["result"]) if tc.get("result") else None,
                duration=tc.get("duration", 0.0),
            )
            for tc in source.get("tool_calls", [])
        ]
        return RecordEvent(
            event_id=source.get("event_id", ""),
            type=source.get("type", "inference"),
            input=source.get("input", ""),
            reasoning=source.get("reasoning", ""),
            output=source.get("output", ""),
            tool_calls=tool_calls,
            timestamp=source.get("timestamp", ""),
            signature=bytes.fromhex(source["signature"]) if source.get("signature") else b"",
        )

    def _ensure_event_id(self, event: RecordEvent) -> None:
        """Ensure event has an ID and timestamp."""
        if not event.event_id:
            event.event_id = str(uuid.uuid4())
        if not event.timestamp:
            event.timestamp = datetime.now(timezone.utc).isoformat()

    def save(self, agent_id: str, event: RecordEvent) -> str:
        """Save a single event to Elasticsearch.

        Args:
            agent_id: Agent identifier.
            event: Event to save.

        Returns:
            The event ID.
        """
        self._ensure_event_id(event)
        doc = self._event_to_doc(agent_id, event)
        index = self._get_index_name(event.timestamp)
        self._ensure_index(index)
        self._es.index(index=index, id=event.event_id, document=doc)
        logger.debug("Saved event %s to Elasticsearch index %s", event.event_id, index)
        return event.event_id

    def save_bulk(self, agent_id: str, events: list[RecordEvent]) -> list[str]:
        """Bulk save multiple events for efficiency.

        Args:
            agent_id: Agent identifier.
            events: List of events to save.

        Returns:
            List of event IDs.

        Raises:
            ImportError: If elasticsearch bulk helper is not available.
        """
        if es_bulk is None:
            raise ImportError("elasticsearch is required for bulk operations")

        actions = []
        event_ids = []
        for event in events:
            self._ensure_event_id(event)
            doc = self._event_to_doc(agent_id, event)
            index = self._get_index_name(event.timestamp)
            self._ensure_index(index)
            actions.append({"_index": index, "_id": event.event_id, "_source": doc})
            event_ids.append(event.event_id)

        if actions:
            es_bulk(self._es, actions)
            logger.info("Bulk saved %d events to Elasticsearch", len(actions))

        return event_ids

    def get_events(self, agent_id: str) -> list[RecordEvent]:
        """Get all events for an agent, sorted by timestamp.

        Args:
            agent_id: Agent identifier.

        Returns:
            List of events sorted by timestamp.
        """
        query = {
            "query": {"term": {"agent_id": agent_id}},
            "sort": [{"timestamp": {"order": "asc"}}],
            "size": _DEFAULT_SEARCH_SIZE,
        }
        index = f"{self._index_prefix}-*"
        result = self._es.search(index=index, body=query)
        return [self._doc_to_event(hit) for hit in result["hits"]["hits"]]

    def get_events_by_type(self, agent_id: str, event_type: str) -> list[RecordEvent]:
        """Get events filtered by type.

        Args:
            agent_id: Agent identifier.
            event_type: Event type to filter by.

        Returns:
            List of matching events.
        """
        query = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"agent_id": agent_id}},
                        {"term": {"type": event_type}},
                    ]
                }
            },
            "sort": [{"timestamp": {"order": "asc"}}],
            "size": _DEFAULT_SEARCH_SIZE,
        }
        index = f"{self._index_prefix}-*"
        result = self._es.search(index=index, body=query)
        return [self._doc_to_event(hit) for hit in result["hits"]["hits"]]

    def get_events_by_time(
        self, agent_id: str, start: str, end: str
    ) -> list[RecordEvent]:
        """Get events within a time range (ISO 8601 format).

        Args:
            agent_id: Agent identifier.
            start: Start timestamp (ISO 8601).
            end: End timestamp (ISO 8601).

        Returns:
            List of events within the time range.
        """
        query = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"agent_id": agent_id}},
                        {"range": {"timestamp": {"gte": start, "lte": end}}},
                    ]
                }
            },
            "sort": [{"timestamp": {"order": "asc"}}],
            "size": _DEFAULT_SEARCH_SIZE,
        }
        index = f"{self._index_prefix}-*"
        result = self._es.search(index=index, body=query)
        return [self._doc_to_event(hit) for hit in result["hits"]["hits"]]

    def search(
        self,
        query_text: str,
        agent_id: str | None = None,
        event_type: str | None = None,
        size: int = 20,
    ) -> list[RecordEvent]:
        """Full-text search across events.

        Args:
            query_text: Search query string.
            agent_id: Optional agent filter.
            event_type: Optional type filter.
            size: Max results to return.

        Returns:
            List of matching events sorted by relevance.
        """
        must_clauses: list[dict[str, Any]] = [
            {
                "multi_match": {
                    "query": query_text,
                    "fields": ["input^2", "reasoning", "output"],
                    "type": "best_fields",
                }
            }
        ]
        if agent_id:
            must_clauses.append({"term": {"agent_id": agent_id}})
        if event_type:
            must_clauses.append({"term": {"type": event_type}})

        query = {
            "query": {"bool": {"must": must_clauses}},
            "sort": [{"_score": {"order": "desc"}}],
            "size": size,
        }
        index = f"{self._index_prefix}-*"
        result = self._es.search(index=index, body=query)
        return [self._doc_to_event(hit) for hit in result["hits"]["hits"]]

    def clear(self, agent_id: str | None = None) -> None:
        """Clear events. If agent_id is provided, only clear that agent's events.

        Args:
            agent_id: Optional agent identifier to filter deletion.
        """
        index = f"{self._index_prefix}-*"
        if agent_id:
            query = {"query": {"term": {"agent_id": agent_id}}}
        else:
            query = {"query": {"match_all": {}}}
        self._es.delete_by_query(index=index, body=query, conflicts="proceed")
        logger.info("Cleared Elasticsearch events%s", f" for {agent_id}" if agent_id else "")

    def count(self, agent_id: str | None = None) -> int:
        """Count events, optionally filtered by agent.

        Args:
            agent_id: Optional agent identifier to filter count.

        Returns:
            Number of events.
        """
        index = f"{self._index_prefix}-*"
        if agent_id:
            query = {"query": {"term": {"agent_id": agent_id}}}
        else:
            query = {"query": {"match_all": {}}}
        result = self._es.count(index=index, body=query)
        return result["count"]

    @property
    def is_connected(self) -> bool:
        """Check if Elasticsearch is reachable.

        Returns:
            True if connection succeeds, False otherwise.
        """
        try:
            return self._es.ping()
        except Exception:
            return False
