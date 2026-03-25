"""S3/对象存储适配器 for Lobster Academy.

Supports archiving events by session to S3-compatible storage.
Supports JSON and Parquet export formats.
Requires: pip install boto3 pyarrow (for Parquet support)
"""

from __future__ import annotations

import gzip
import json
import logging
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Optional

from ..recorder import StorageBackend
from ..types import RecordEvent, ToolCall

try:
    import boto3  # type: ignore[import-untyped]
except ImportError:
    boto3 = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


class S3Storage(StorageBackend):
    """S3-compatible object storage for event archiving.

    Stores events as files in S3, organized by agent_id/session_id.
    Supports both JSON and Parquet formats.

    Args:
        bucket: S3 bucket name.
        prefix: Key prefix for all objects.
        region: AWS region.
        endpoint_url: Custom endpoint (for MinIO, LocalStack, etc.).
        format: Export format - "json" or "parquet".
        aws_access_key_id: AWS access key.
        aws_secret_access_key: AWS secret key.

    Example:
        >>> storage = S3Storage(
        ...     bucket="lobster-events",
        ...     endpoint_url="http://localhost:9000",
        ...     format="parquet",
        ... )
        >>> storage.save("agent-001", event)
        >>> storage.archive_session("agent-001", "session-abc")
        >>> events = storage.get_events("agent-001")
    """

    def __init__(
        self,
        bucket: str,
        prefix: str = "events",
        region: str = "us-east-1",
        endpoint_url: str | None = None,
        export_format: str = "json",
        aws_access_key_id: str | None = None,
        aws_secret_access_key: str | None = None,
        **kwargs: Any,
    ) -> None:
        if boto3 is None:
            raise ImportError(
                "boto3 is required for S3 storage. "
                "Install it with: pip install boto3"
            )

        if export_format not in ("json", "parquet"):
            raise ValueError("export_format must be 'json' or 'parquet'")

        self._s3 = boto3.client(
            "s3",
            region_name=region,
            endpoint_url=endpoint_url,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            **kwargs,
        )
        self._bucket = bucket
        self._prefix = prefix.rstrip("/")
        self._format = export_format

        # In-memory buffer for events before archiving
        self._buffer: dict[str, list[dict[str, Any]]] = {}
        self._session_id: str | None = None

    def _make_key(self, agent_id: str, session_id: str | None = None) -> str:
        """Generate S3 key for a session archive."""
        sid = session_id or "default"
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        ext = "parquet.gz" if self._format == "parquet" else "json.gz"
        return f"{self._prefix}/{agent_id}/{sid}/{ts}.{ext}"

    def _event_to_dict(self, agent_id: str, event: RecordEvent) -> dict[str, Any]:
        """Convert RecordEvent to a serializable dict."""
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
                    "result": tc.result,
                    "duration": tc.duration,
                }
                for tc in event.tool_calls
            ],
            "timestamp": event.timestamp,
            "signature": event.signature.hex() if event.signature else "",
        }

    def _dict_to_event(self, data: dict[str, Any]) -> RecordEvent:
        """Convert dict back to RecordEvent."""
        tool_calls = [
            ToolCall(
                name=tc["name"],
                params=tc.get("params", {}),
                result=tc.get("result"),
                duration=tc.get("duration", 0.0),
            )
            for tc in data.get("tool_calls", [])
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
        """Save event to in-memory buffer (flush with archive_session)."""
        if not event.event_id:
            import uuid
            event.event_id = str(uuid.uuid4())
        if not event.timestamp:
            event.timestamp = datetime.now(timezone.utc).isoformat()

        if agent_id not in self._buffer:
            self._buffer[agent_id] = []
        self._buffer[agent_id].append(self._event_to_dict(agent_id, event))
        return event.event_id

    def set_session(self, session_id: str) -> None:
        """Set the session ID for archiving."""
        self._session_id = session_id

    def archive_session(
        self,
        agent_id: str,
        session_id: str | None = None,
        events: list[dict[str, Any]] | None = None,
    ) -> str:
        """Archive buffered events to S3.

        Args:
            agent_id: Agent identifier.
            session_id: Session identifier (uses set_session or 'default').
            events: Optional explicit event list; otherwise uses buffer.

        Returns:
            S3 key of the archived file.
        """
        sid = session_id or self._session_id or "default"
        data = events if events is not None else self._buffer.get(agent_id, [])
        if not data:
            raise ValueError(f"No events to archive for agent {agent_id}")

        key = self._make_key(agent_id, sid)

        if self._format == "parquet":
            body = self._to_parquet(data)
        else:
            body = gzip.compress(json.dumps(data, ensure_ascii=False).encode("utf-8"))

        self._s3.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=body,
            ContentEncoding="gzip",
            ContentType="application/octet-stream" if self._format == "parquet" else "application/json",
            Metadata={
                "agent_id": agent_id,
                "session_id": sid,
                "event_count": str(len(data)),
                "format": self._format,
            },
        )

        # Clear buffer after archiving
        if agent_id in self._buffer:
            del self._buffer[agent_id]

        logger.info(f"Archived {len(data)} events to s3://{self._bucket}/{key}")
        return key

    def _to_parquet(self, data: list[dict[str, Any]]) -> bytes:
        """Convert event dicts to Parquet bytes."""
        try:
            import pyarrow as pa  # type: ignore[import-untyped]
            import pyarrow.parquet as pq  # type: ignore[import-untyped]
        except ImportError:
            raise ImportError(
                "pyarrow is required for Parquet export. "
                "Install it with: pip install pyarrow"
            )

        # Flatten for Parquet
        rows = []
        for d in data:
            row = {
                "event_id": d["event_id"],
                "agent_id": d["agent_id"],
                "type": d["type"],
                "input": d["input"],
                "reasoning": d["reasoning"],
                "output": d["output"],
                "tool_calls": json.dumps(d["tool_calls"], ensure_ascii=False),
                "timestamp": d["timestamp"],
                "signature": d["signature"],
            }
            rows.append(row)

        table = pa.Table.from_pylist(rows)
        buf = BytesIO()
        pq.write_table(table, buf, compression="gzip")
        return buf.getvalue()

    def get_events(self, agent_id: str) -> list[RecordEvent]:
        """Get all archived events for an agent by listing and reading S3 objects."""
        prefix = f"{self._prefix}/{agent_id}/"
        events: list[RecordEvent] = []

        paginator = self._s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self._bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                try:
                    response = self._s3.get_object(Bucket=self._bucket, Key=key)
                    body = gzip.decompress(response["Body"].read())
                    data = json.loads(body)
                    if isinstance(data, list):
                        events.extend(self._dict_to_event(d) for d in data)
                except Exception as e:
                    logger.warning(f"Failed to read {key}: {e}")

        return sorted(events, key=lambda e: e.timestamp)

    def list_archives(self, agent_id: str) -> list[dict[str, Any]]:
        """List all archive files for an agent."""
        prefix = f"{self._prefix}/{agent_id}/"
        archives = []

        paginator = self._s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self._bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                archives.append({
                    "key": obj["Key"],
                    "size": obj["Size"],
                    "last_modified": obj["LastModified"].isoformat(),
                })

        return sorted(archives, key=lambda a: a["last_modified"])

    def clear(self, agent_id: str | None = None) -> None:
        """Clear archived events and buffer."""
        if agent_id:
            # Clear S3 objects
            prefix = f"{self._prefix}/{agent_id}/"
            paginator = self._s3.get_paginator("list_objects_v2")
            objects_to_delete = []
            for page in paginator.paginate(Bucket=self._bucket, Prefix=prefix):
                for obj in page.get("Contents", []):
                    objects_to_delete.append({"Key": obj["Key"]})

            if objects_to_delete:
                self._s3.delete_objects(
                    Bucket=self._bucket,
                    Delete={"Objects": objects_to_delete},
                )

            # Clear buffer
            self._buffer.pop(agent_id, None)
        else:
            # Clear all under prefix
            paginator = self._s3.get_paginator("list_objects_v2")
            objects_to_delete = []
            for page in paginator.paginate(Bucket=self._bucket, Prefix=f"{self._prefix}/"):
                for obj in page.get("Contents", []):
                    objects_to_delete.append({"Key": obj["Key"]})

            if objects_to_delete:
                self._s3.delete_objects(
                    Bucket=self._bucket,
                    Delete={"Objects": objects_to_delete},
                )

            self._buffer.clear()

        logger.info(f"Cleared S3 events{' for ' + agent_id if agent_id else ''}")

    def count(self, agent_id: str | None = None) -> int:
        """Count total events across all archives."""
        total = 0
        agents = [agent_id] if agent_id else list(self._buffer.keys())

        for aid in agents:
            prefix = f"{self._prefix}/{aid}/"
            paginator = self._s3.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=self._bucket, Prefix=prefix):
                for obj in page.get("Contents", []):
                    meta = obj.get("Metadata", {})
                    total += int(meta.get("event_count", 0))

            # Also count buffer
            total += len(self._buffer.get(aid, []))

        return total

    @property
    def is_connected(self) -> bool:
        """Check if S3 is reachable."""
        try:
            self._s3.head_bucket(Bucket=self._bucket)
            return True
        except Exception:
            return False
