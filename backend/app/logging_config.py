"""Structured, redacting application logging.

Log records are emitted as JSON on stdout so hosted platforms can index them.
The redaction filter is applied even if a caller accidentally passes a secret
in a log message or ``extra`` value.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

REDACTED = "***REDACTED***"

_SENSITIVE_KEY = re.compile(
    r"(password|passwd|secret|token|authorization|api[_-]?key|database_url|dsn)",
    re.IGNORECASE,
)
_KEY_VALUE_SECRET = re.compile(
    r"(?i)\b(password|passwd|secret|token|authorization|api[_-]?key|database_url|dsn)"
    r"\s*[:=]\s*([^\s,;]+)"
)
_BEARER_TOKEN = re.compile(r"(?i)bearer\s+\S+")
_DB_URL_CREDENTIALS = re.compile(r"(?i)(mysql(?:\+pymysql)?://)[^\s@/]+:[^\s@/]+@")
_STRUCTURED_FIELDS = (
    "event",
    "request_id",
    "method",
    "path",
    "status_code",
    "duration_ms",
    "exception_type",
)


def redact(value: Any) -> Any:
    """Recursively remove common secret patterns from log payloads."""
    if isinstance(value, dict):
        return {
            key: REDACTED if _SENSITIVE_KEY.search(str(key)) else redact(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return type(value)(redact(item) for item in value)
    if isinstance(value, str):
        value = _KEY_VALUE_SECRET.sub(lambda m: f"{m.group(1)}={REDACTED}", value)
        value = _BEARER_TOKEN.sub(f"Bearer {REDACTED}", value)
        value = _DB_URL_CREDENTIALS.sub(rf"\1{REDACTED}@", value)
        return value
    return value


class RedactingFilter(logging.Filter):
    """Filter that redacts secrets from messages and arguments."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: D102 - stdlib hook
        if isinstance(record.msg, str):
            record.msg = redact(record.msg)
        if isinstance(record.args, dict):
            record.args = redact(record.args)
        elif record.args:
            record.args = tuple(redact(arg) for arg in record.args)
        return True


class JsonFormatter(logging.Formatter):
    """Minimal JSON formatter with a stable, safe field set."""

    def format(self, record: logging.LogRecord) -> str:  # noqa: D102 - stdlib hook
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for field in _STRUCTURED_FIELDS:
            if hasattr(record, field):
                payload[field] = getattr(record, field)
        return json.dumps(redact(payload), default=str)


def configure_logging(level: int = logging.INFO) -> None:
    """Install one structured stdout handler, safe to call more than once."""
    root = logging.getLogger()
    root.setLevel(level)
    if any(getattr(handler, "_stockiq_structured", False) for handler in root.handlers):
        return

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    handler.addFilter(RedactingFilter())
    handler._stockiq_structured = True  # type: ignore[attr-defined]
    root.addHandler(handler)
