"""Tests for storage adapters.

These tests use mocks to avoid requiring actual service connections.
Each adapter is tested for: basic CRUD, query operations, and error handling.
"""

import pytest
from unittest.mock import MagicMock, patch, PropertyMock
from datetime import datetime, timezone

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from lobster_academy.types import RecordEvent, ToolCall


def _make_event(
    event_id: str = "test-001",
    event_type: str = "inference",
    input_text: str = "hello",
    output_text: str = "world",
) -> RecordEvent:
    """Helper to create a test event."""
    return RecordEvent(
        event_id=event_id,
        type=event_type,
        input=input_text,
        output=output_text,
        reasoning="thinking...",
        tool_calls=[
            ToolCall(name="search", params={"q": "test"}, result="found", duration=0.5)
        ],
        timestamp=datetime.now(timezone.utc).isoformat(),
        signature=b"\x00\x01\x02",
    )


# ═══════════════════════════════════════════
# Elasticsearch Tests
# ═══════════════════════════════════════════

class TestElasticsearchStorage:
    """Tests for ElasticsearchStorage adapter."""

    @patch("lobster_academy.storage.elasticsearch_adapter.Elasticsearch")
    def test_save_event(self, mock_es_cls):
        """Test saving a single event."""
        from lobster_academy.storage import ElasticsearchStorage

        mock_es = MagicMock()
        mock_es.ping.return_value = True
        mock_es.indices.exists.return_value = True
        mock_es_cls.return_value = mock_es

        storage = ElasticsearchStorage(["http://localhost:9200"])
        event = _make_event()
        result = storage.save("agent-001", event)

        assert result == "test-001"
        mock_es.index.assert_called_once()

    @patch("lobster_academy.storage.elasticsearch_adapter.Elasticsearch")
    def test_get_events(self, mock_es_cls):
        """Test retrieving events."""
        from lobster_academy.storage import ElasticsearchStorage

        mock_es = MagicMock()
        mock_es.ping.return_value = True
        mock_es.search.return_value = {
            "hits": {
                "hits": [
                    {
                        "_source": {
                            "event_id": "test-001",
                            "type": "inference",
                            "input": "hello",
                            "reasoning": "",
                            "output": "world",
                            "tool_calls": [],
                            "timestamp": "2024-01-01T00:00:00+00:00",
                            "signature": "",
                        }
                    }
                ]
            }
        }
        mock_es_cls.return_value = mock_es

        storage = ElasticsearchStorage(["http://localhost:9200"])
        events = storage.get_events("agent-001")

        assert len(events) == 1
        assert events[0].event_id == "test-001"
        assert events[0].input == "hello"

    @patch("lobster_academy.storage.elasticsearch_adapter.Elasticsearch")
    def test_full_text_search(self, mock_es_cls):
        """Test full-text search functionality."""
        from lobster_academy.storage import ElasticsearchStorage

        mock_es = MagicMock()
        mock_es.ping.return_value = True
        mock_es.search.return_value = {"hits": {"hits": []}}
        mock_es_cls.return_value = mock_es

        storage = ElasticsearchStorage(["http://localhost:9200"])
        results = storage.search("error timeout", agent_id="agent-001", size=10)

        assert results == []
        # Verify the search was called with correct query structure
        call_args = mock_es.search.call_args
        query = call_args[1]["body"]["query"]["bool"]["must"]
        assert any("multi_match" in clause for clause in query)

    @patch("lobster_academy.storage.elasticsearch_adapter.Elasticsearch")
    def test_clear_events(self, mock_es_cls):
        """Test clearing events."""
        from lobster_academy.storage import ElasticsearchStorage

        mock_es = MagicMock()
        mock_es.ping.return_value = True
        mock_es_cls.return_value = mock_es

        storage = ElasticsearchStorage(["http://localhost:9200"])
        storage.clear("agent-001")

        mock_es.delete_by_query.assert_called_once()


# ═══════════════════════════════════════════
# ClickHouse Tests
# ═══════════════════════════════════════════

class TestClickHouseStorage:
    """Tests for ClickHouseStorage adapter."""

    @patch("lobster_academy.storage.clickhouse_adapter.Client")
    def test_save_event(self, mock_client_cls):
        """Test saving a single event."""
        from lobster_academy.storage import ClickHouseStorage

        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        storage = ClickHouseStorage(host="localhost", password="test")
        event = _make_event()
        result = storage.save("agent-001", event)

        assert result == "test-001"
        mock_client.execute.assert_called()

    @patch("lobster_academy.storage.clickhouse_adapter.Client")
    def test_batch_save(self, mock_client_cls):
        """Test batch saving events."""
        from lobster_academy.storage import ClickHouseStorage

        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        storage = ClickHouseStorage(host="localhost", password="test")
        events = [_make_event(f"event-{i}") for i in range(5)]
        result = storage.save_batch("agent-001", events)

        assert len(result) == 5
        assert all(eid.startswith("event-") for eid in result)

    @patch("lobster_academy.storage.clickhouse_adapter.Client")
    def test_aggregate_by_type(self, mock_client_cls):
        """Test aggregation query."""
        from lobster_academy.storage import ClickHouseStorage

        mock_client = MagicMock()
        mock_client.execute.return_value = [
            ("inference", 100, datetime(2024, 1, 1), datetime(2024, 1, 2)),
            ("tool_call", 50, datetime(2024, 1, 1), datetime(2024, 1, 2)),
        ]
        mock_client_cls.return_value = mock_client

        storage = ClickHouseStorage(host="localhost", password="test")
        stats = storage.aggregate_by_type("agent-001")

        assert len(stats) == 2
        assert stats[0]["event_type"] == "inference"
        assert stats[0]["count"] == 100

    @patch("lobster_academy.storage.clickhouse_adapter.Client")
    def test_connection_check(self, mock_client_cls):
        """Test connection check."""
        from lobster_academy.storage import ClickHouseStorage

        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        storage = ClickHouseStorage(host="localhost", password="test")
        assert storage.is_connected is True


# ═══════════════════════════════════════════
# S3 Tests
# ═══════════════════════════════════════════

class TestS3Storage:
    """Tests for S3Storage adapter."""

    @patch("lobster_academy.storage.s3_adapter.boto3")
    def test_save_and_buffer(self, mock_boto3):
        """Test that events are buffered before archiving."""
        from lobster_academy.storage import S3Storage

        mock_s3 = MagicMock()
        mock_boto3.client.return_value = mock_s3

        storage = S3Storage(bucket="test-bucket")
        event = _make_event()
        result = storage.save("agent-001", event)

        assert result == "test-001"
        # Event should be in buffer, not yet uploaded
        assert len(storage._buffer.get("agent-001", [])) == 1

    @patch("lobster_academy.storage.s3_adapter.boto3")
    def test_archive_session(self, mock_boto3):
        """Test archiving buffered events."""
        from lobster_academy.storage import S3Storage

        mock_s3 = MagicMock()
        mock_boto3.client.return_value = mock_s3

        storage = S3Storage(bucket="test-bucket")
        event = _make_event()
        storage.save("agent-001", event)

        key = storage.archive_session("agent-001", "session-abc")

        assert "agent-001" in key
        assert "session-abc" in key
        mock_s3.put_object.assert_called_once()
        # Buffer should be cleared
        assert "agent-001" not in storage._buffer

    @patch("lobster_academy.storage.s3_adapter.boto3")
    def test_archive_empty_raises(self, mock_boto3):
        """Test that archiving with no events raises error."""
        from lobster_academy.storage import S3Storage

        mock_s3 = MagicMock()
        mock_boto3.client.return_value = mock_s3

        storage = S3Storage(bucket="test-bucket")

        with pytest.raises(ValueError, match="No events to archive"):
            storage.archive_session("agent-001")

    @patch("lobster_academy.storage.s3_adapter.boto3")
    def test_clear_events(self, mock_boto3):
        """Test clearing S3 objects and buffer."""
        from lobster_academy.storage import S3Storage

        mock_s3 = MagicMock()
        mock_paginator = MagicMock()
        mock_s3.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [{"Contents": []}]
        mock_boto3.client.return_value = mock_s3

        storage = S3Storage(bucket="test-bucket")
        storage.save("agent-001", _make_event())
        storage.clear("agent-001")

        assert "agent-001" not in storage._buffer


# ═══════════════════════════════════════════
# Redis Tests
# ═══════════════════════════════════════════

class TestRedisStorage:
    """Tests for RedisStorage adapter."""

    @patch("lobster_academy.storage.redis_adapter.redis")
    def test_save_event(self, mock_redis):
        """Test saving a single event to Redis stream."""
        from lobster_academy.storage import RedisStorage

        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_redis.Redis.return_value = mock_client

        storage = RedisStorage()
        event = _make_event()
        result = storage.save("agent-001", event)

        assert result == "test-001"
        mock_client.xadd.assert_called_once()
        mock_client.incr.assert_called_once()
        mock_client.publish.assert_called_once()

    @patch("lobster_academy.storage.redis_adapter.redis")
    def test_get_events(self, mock_redis):
        """Test retrieving events from Redis stream."""
        from lobster_academy.storage import RedisStorage

        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.xrange.return_value = [
            ("1234567890-0", {
                "event_id": "test-001",
                "agent_id": "agent-001",
                "type": "inference",
                "input": "hello",
                "reasoning": "",
                "output": "world",
                "tool_calls": "[]",
                "timestamp": "2024-01-01T00:00:00+00:00",
                "signature": "",
            })
        ]
        mock_redis.Redis.return_value = mock_client

        storage = RedisStorage()
        events = storage.get_events("agent-001")

        assert len(events) == 1
        assert events[0].event_id == "test-001"
        assert events[0].input == "hello"

    @patch("lobster_academy.storage.redis_adapter.redis")
    def test_clear_events(self, mock_redis):
        """Test clearing Redis keys."""
        from lobster_academy.storage import RedisStorage

        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_redis.Redis.return_value = mock_client

        storage = RedisStorage()
        storage.clear("agent-001")

        # Should delete stream and counter keys
        mock_client.delete.assert_called()

    @patch("lobster_academy.storage.redis_adapter.redis")
    def test_ttl_operations(self, mock_redis):
        """Test TTL set/get operations."""
        from lobster_academy.storage import RedisStorage

        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.ttl.return_value = 3600
        mock_redis.Redis.return_value = mock_client

        storage = RedisStorage(ttl_seconds=7200)
        storage.set_ttl("agent-001", 3600)

        mock_client.expire.assert_called()
        assert storage.get_ttl("agent-001") == 3600

    @patch("lobster_academy.storage.redis_adapter.redis")
    def test_count(self, mock_redis):
        """Test counting events."""
        from lobster_academy.storage import RedisStorage

        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.xlen.return_value = 42
        mock_redis.Redis.return_value = mock_client

        storage = RedisStorage()
        count = storage.count("agent-001")

        assert count == 42
