"""Where audit entries go: a local temp file or the audit_events table.

Chosen by ``settings.audit_backend`` at write time ("file" locally, "db" in
production and tests).
"""

import asyncio
import json
import os
from datetime import datetime
from typing import Any

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.audit_event import AuditEvent

# Module attribute so tests can swap in a NullPool session factory.
session_factory = AsyncSessionLocal


def _json_default(value: Any) -> str:
    return value.isoformat() if isinstance(value, datetime) else str(value)


class FileAuditWriter:
    """Appends one JSON line per entry. O_APPEND with a single write() per
    line keeps lines whole when several uvicorn processes share the file."""

    def __init__(self, path: str) -> None:
        self.path = path

    def _append(self, line: bytes) -> None:
        fd = os.open(self.path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
        try:
            os.write(fd, line)
        finally:
            os.close(fd)

    async def write(self, entry: dict[str, Any]) -> None:
        line = (json.dumps(entry, default=_json_default) + "\n").encode()
        await asyncio.to_thread(self._append, line)


class DbAuditWriter:
    """Inserts one audit_events row per entry, in its own session/transaction."""

    async def write(self, entry: dict[str, Any]) -> None:
        async with session_factory() as db:
            db.add(AuditEvent(**entry))
            await db.commit()


async def write(entry: dict[str, Any]) -> None:
    if settings.audit_backend == "file":
        await FileAuditWriter(settings.audit_file_path).write(entry)
    else:
        await DbAuditWriter().write(entry)
