"""Audit middleware: one audit entry per meaningful API request.

Recorded: every change (any method other than GET/HEAD), every failed or
denied request (4xx/5xx, reads included), and successful opens of a specific
document or version (RECORDED_READS). Skipped: other successful reads (page
loads, lists, polling, photo thumbnails), which are noise for "who did what".
See should_record.

Plain ASGI (not BaseHTTPMiddleware) so it sees the real status code, including
unhandled exceptions, which it records as 500 before re-raising. The entry is
written after the endpoint finishes, in its own transaction; a failed write is
logged as ``audit_write_failed`` and never affects the user's response.

Endpoints add context through ``request.state``:
  user_id / user_email / user_name / user_role
                                    set by get_current_user (or login/logout)
  audit_details                     dict of extras (never secrets or content)
  audit_project_id                  project id when it isn't in the URL
"""

import time
import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.audit import writers

logger = structlog.get_logger(__name__)

USER_AGENT_MAX = 300

# Never audited: Docker's health check. (OPTIONS is skipped by method.)
SKIPPED_PATHS = frozenset({"/health"})

READ_METHODS = frozenset({"GET", "HEAD"})

# Successful reads still recorded: opening a specific document or version
# answers "which documents did this account look at?" (UK GDPR breach reports).
RECORDED_READS = frozenset(
    {
        "/documents/{document_id}",
        "/documents/{document_id}/versions/{version_id}",
    }
)


def should_record(method: str, route: str, status_code: int) -> bool:
    if method not in READ_METHODS:
        return True  # changes, logins, logouts, searches
    if status_code >= 400:
        return True  # denied / failed reads: how probing shows up
    return route in RECORDED_READS


_ENTITY_PARAMS = [
    ("photo_id", "photo"),
    ("version_id", "document_version"),
    ("user_id", "user"),
    ("document_id", "document"),
    ("project_id", "project"),
]


def outcome_for(status_code: int) -> str:
    if status_code >= 500:
        return "error"
    if status_code >= 400:
        return "denied"
    return "success"


def route_template(path: str, path_params: dict[str, Any]) -> str:
    """Turn the requested URL back into its route template by swapping path
    parameter values for their names:
    /projects/7/photos/3f2a… → /projects/{project_id}/photos/{photo_id}.

    Requests that matched no route have no path params, so they keep their
    raw path.
    """
    names = {str(value): f"{{{name}}}" for name, value in path_params.items()}
    return "/".join(names.get(segment, segment) for segment in path.split("/"))


def _to_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _to_uuid(value: Any) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


def _header(scope: Scope, name: bytes) -> str | None:
    for key, value in scope.get("headers", []):
        if key == name:
            return value.decode("latin-1")
    return None


def build_entry(
    scope: Scope, status_code: int, started_at: datetime, duration_ms: float
) -> dict[str, Any]:
    path_params = scope.get("path_params") or {}
    state = scope.get("state") or {}

    entity_type = entity_id = None
    for param, kind in _ENTITY_PARAMS:
        if param in path_params:
            entity_type, entity_id = kind, str(path_params[param])
            break

    project_id = _to_int(path_params.get("project_id"))
    if project_id is None:
        project_id = _to_int(state.get("audit_project_id"))

    client = scope.get("client")
    user_agent = _header(scope, b"user-agent")

    return {
        "created_at": started_at,
        "actor_user_id": _to_uuid(state.get("user_id")),
        "actor_email": state.get("user_email"),
        "actor_name": state.get("user_name"),
        "actor_role": state.get("user_role"),
        "method": scope["method"],
        "route": route_template(scope["path"], path_params),
        "status_code": status_code,
        "outcome": outcome_for(status_code),
        "project_id": project_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "ip_address": client[0] if client else None,
        "user_agent": user_agent[:USER_AGENT_MAX] if user_agent else None,
        "duration_ms": round(duration_ms),
        "details": dict(state.get("audit_details") or {}),
    }


class AuditMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope["method"] == "OPTIONS"
            or scope["path"] in SKIPPED_PATHS
        ):
            await self.app(scope, receive, send)
            return

        started_at = datetime.now(UTC)
        start = time.monotonic()
        status_code = 500  # if the app raises before sending a response

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            status_code = 500
            raise
        finally:
            duration_ms = (time.monotonic() - start) * 1000
            await self._record(scope, status_code, started_at, duration_ms)

    async def _record(
        self, scope: Scope, status_code: int, started_at: datetime, duration_ms: float
    ) -> None:
        try:
            entry = build_entry(scope, status_code, started_at, duration_ms)
            if not should_record(entry["method"], entry["route"], status_code):
                return
            # Also a log line, so in production the log shipper keeps an
            # off-server copy of every entry.
            logger.info(
                "audit_event",
                **{k: v for k, v in entry.items() if k != "created_at"},
            )
            await writers.write(entry)
        except Exception:
            logger.exception("audit_write_failed", path=scope.get("path"))
