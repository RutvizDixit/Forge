from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import config


class TraceLedger:
    """
    Lightweight append-only trace ledger for FORGE.

    Each event records a meaningful step in the processing chain:

    source
        ↓
    ingestion
        ↓
    normalization
        ↓
    enrichment
        ↓
    validation
        ↓
    decision
        ↓
    export

    The ledger is designed for auditability and review rather than
    as a replacement for a database.
    """

    def __init__(
        self,
        ledger_path: Optional[str | Path] = None,
    ):
        self.ledger_path = Path(
            ledger_path
            or (
                config.OUTPUT_DIR
                / "forge_trace.jsonl"
            )
        )

        self.ledger_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

    def record(
        self,
        event_type: str,
        data: Optional[Dict[str, Any]] = None,
        source_id: Optional[str] = None,
        record_id: Optional[str] = None,
        parent_event_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        event = {
            "event_id": self._event_id(),
            "timestamp": self._timestamp(),
            "event_type": str(
                event_type
            ).strip(),
            "source_id": source_id,
            "record_id": record_id,
            "parent_event_id": parent_event_id,
            "data": self._serializable(
                data or {}
            ),
        }

        event["event_hash"] = self._hash_event(
            event
        )

        self._append(
            event
        )

        return event

    def record_source(
        self,
        source_id: str,
        source_name: str,
        source_type: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self.record(
            event_type="source_received",
            source_id=source_id,
            data={
                "source_name": source_name,
                "source_type": source_type,
                "metadata": metadata or {},
            },
        )

    def record_processing(
        self,
        source_id: str,
        stage: str,
        status: str,
        details: Optional[Dict[str, Any]] = None,
        parent_event_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self.record(
            event_type="processing",
            source_id=source_id,
            parent_event_id=parent_event_id,
            data={
                "stage": stage,
                "status": status,
                "details": details or {},
            },
        )

    def record_decision(
        self,
        record_id: str,
        decision: Dict[str, Any],
        source_id: Optional[str] = None,
        parent_event_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self.record(
            event_type="decision",
            source_id=source_id,
            record_id=record_id,
            parent_event_id=parent_event_id,
            data={
                "decision": decision,
            },
        )

    def record_export(
        self,
        filename: str,
        export_format: str,
        record_count: Optional[int] = None,
        parent_event_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self.record(
            event_type="export",
            parent_event_id=parent_event_id,
            data={
                "filename": filename,
                "format": export_format,
                "record_count": record_count,
            },
        )

    def get_events(
        self,
        source_id: Optional[str] = None,
        record_id: Optional[str] = None,
        event_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if not self.ledger_path.exists():
            return []

        events = []

        with self.ledger_path.open(
            "r",
            encoding="utf-8",
        ) as file:
            for line in file:
                line = line.strip()

                if not line:
                    continue

                try:
                    event = json.loads(
                        line
                    )
                except json.JSONDecodeError:
                    continue

                if (
                    source_id is not None
                    and event.get(
                        "source_id"
                    ) != source_id
                ):
                    continue

                if (
                    record_id is not None
                    and event.get(
                        "record_id"
                    ) != record_id
                ):
                    continue

                if (
                    event_type is not None
                    and event.get(
                        "event_type"
                    ) != event_type
                ):
                    continue

                events.append(
                    event
                )

        return events

    def get_record_trace(
        self,
        record_id: str,
    ) -> List[Dict[str, Any]]:
        return self.get_events(
            record_id=record_id
        )

    def get_source_trace(
        self,
        source_id: str,
    ) -> List[Dict[str, Any]]:
        return self.get_events(
            source_id=source_id
        )

    def summarize_trace(
        self,
        record_id: Optional[str] = None,
        source_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        events = self.get_events(
            source_id=source_id,
            record_id=record_id,
        )

        if not events:
            return {
                "event_count": 0,
                "first_event": None,
                "last_event": None,
                "stages": [],
                "status": "not_found",
            }

        stages = []

        for event in events:
            event_type = event.get(
                "event_type",
                "",
            )

            if event_type not in stages:
                stages.append(
                    event_type
                )

        return {
            "event_count": len(
                events
            ),
            "first_event": events[0],
            "last_event": events[-1],
            "stages": stages,
            "status": "available",
        }

    def verify_integrity(self) -> Dict[str, Any]:
        if not self.ledger_path.exists():
            return {
                "valid": True,
                "events_checked": 0,
                "invalid_events": [],
            }

        invalid_events = []
        checked = 0

        with self.ledger_path.open(
            "r",
            encoding="utf-8",
        ) as file:
            for line_number, line in enumerate(
                file,
                start=1,
            ):
                line = line.strip()

                if not line:
                    continue

                try:
                    event = json.loads(
                        line
                    )

                    stored_hash = event.get(
                        "event_hash"
                    )

                    if not stored_hash:
                        invalid_events.append(
                            line_number
                        )
                        continue

                    event_copy = dict(
                        event
                    )

                    event_copy.pop(
                        "event_hash",
                        None,
                    )

                    calculated_hash = (
                        self._hash_event(
                            event_copy
                        )
                    )

                    if calculated_hash != stored_hash:
                        invalid_events.append(
                            line_number
                        )

                    checked += 1

                except (
                    json.JSONDecodeError,
                    TypeError,
                ):
                    invalid_events.append(
                        line_number
                    )

        return {
            "valid": not invalid_events,
            "events_checked": checked,
            "invalid_events": invalid_events,
        }

    def export_trace(
        self,
        output_path: Optional[str | Path] = None,
        source_id: Optional[str] = None,
        record_id: Optional[str] = None,
    ) -> Path:
        events = self.get_events(
            source_id=source_id,
            record_id=record_id,
        )

        path = Path(
            output_path
            or (
                config.EXPORT_DIR
                / "forge_trace.json"
            )
        )

        path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with path.open(
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                events,
                file,
                ensure_ascii=False,
                indent=2,
            )

        return path

    def clear(
        self,
    ) -> None:
        if self.ledger_path.exists():
            self.ledger_path.unlink()

    def _append(
        self,
        event: Dict[str, Any],
    ) -> None:
        with self.ledger_path.open(
            "a",
            encoding="utf-8",
        ) as file:
            file.write(
                json.dumps(
                    event,
                    ensure_ascii=False,
                    sort_keys=True,
                )
                + "\n"
            )

    @staticmethod
    def _event_id() -> str:
        return (
            f"evt-{uuid.uuid4().hex[:16]}"
        )

    @staticmethod
    def _timestamp() -> str:
        return datetime.now(
            timezone.utc
        ).isoformat()

    @staticmethod
    def _hash_event(
        event: Dict[str, Any],
    ) -> str:
        payload = json.dumps(
            event,
            ensure_ascii=False,
            sort_keys=True,
        )

        return hashlib.sha256(
            payload.encode(
                "utf-8"
            )
        ).hexdigest()

    @staticmethod
    def _serializable(
        value: Any,
    ) -> Any:
        if isinstance(
            value,
            dict,
        ):
            return {
                str(key): TraceLedger._serializable(
                    item
                )
                for key, item in value.items()
            }

        if isinstance(
            value,
            list,
        ):
            return [
                TraceLedger._serializable(
                    item
                )
                for item in value
            ]

        if isinstance(
            value,
            tuple,
        ):
            return [
                TraceLedger._serializable(
                    item
                )
                for item in value
            ]

        if hasattr(
            value,
            "item",
        ):
            try:
                return value.item()
            except Exception:
                pass

        if hasattr(
            value,
            "to_dict",
        ):
            try:
                return TraceLedger._serializable(
                    value.to_dict()
                )
            except Exception:
                pass

        return value