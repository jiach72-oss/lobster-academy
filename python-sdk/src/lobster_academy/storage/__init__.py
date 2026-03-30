"""Lobster Academy Storage Adapters.

Provides pluggable storage backends for agent event recording:
- ElasticsearchAdapter: Full-text search and analytics
- ClickHouseAdapter: High-throughput event streams with aggregation
- S3Adapter: Object storage archiving (JSON/Parquet)
- RedisAdapter: Real-time event cache with TTL
"""

from .elasticsearch_adapter import ElasticsearchStorage
from .clickhouse_adapter import ClickHouseStorage
from .s3_adapter import S3Storage
from .redis_adapter import RedisStorage

__all__ = [
    "ElasticsearchStorage",
    "ClickHouseStorage",
    "S3Storage",
    "RedisStorage",
]
