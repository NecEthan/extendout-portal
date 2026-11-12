"""Audit logging: middleware, writers and the append-only trigger.

Audit rows can't be deleted (append-only trigger), so every assertion selects
rows by ids the test itself created (its own user, a unique email, ...).
"""

import json
import uuid
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.audit import writers
from app.audit.middleware import route_template, should_record
from app.main import app
from app.models.base import AuditEvent
from tests.fixtures.auth import TEST_PROJECT_ID, UNKNOWN_PROJECT_ID
from tests.helpers.processing import upload_doc


async def _events(db, **filters) -> list[AuditEvent]:
    db.expire_all()
    stmt = select(AuditEvent).order_by(AuditEvent.created_at)
    for column, value in filters.items():
        stmt = stmt.where(getattr(AuditEvent, column) == value)
    return list((await db.execute(stmt)).scalars())


# ── Route templates ───────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("path", "params", "expected"),
    [
        (
            "/projects/7/photos/3f2a",
            {"project_id": "7", "photo_id": "3f2a"},
            "/projects/{project_id}/photos/{photo_id}",
        ),
        (
            "/documents/ab12/versions/cd34/activate",
            {"document_id": "ab12", "version_id": "cd34"},
            "/documents/{document_id}/versions/{version_id}/activate",
        ),
        ("/auth/login", {}, "/auth/login"),
        # Matched no route: no params, so the raw path is kept.
        ("/wp-admin", {}, "/wp-admin"),
    ],
)
def test_route_template(path, params, expected):
    assert route_template(path, params) == expected


# ── What gets recorded ────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("method", "route", "status", "recorded"),
    [
        # Changes, logins and searches: always.
        ("POST", "/documents", 202, True),
        ("DELETE", "/projects/{project_id}/photos/{photo_id}", 204, True),
        ("POST", "/auth/login", 200, True),
        ("POST", "/query", 200, True),
        # Opening a specific document or version: recorded.
        ("GET", "/documents/{document_id}", 200, True),
        ("GET", "/documents/{document_id}/versions/{version_id}", 200, True),
        ("GET", "/documents/{document_id}/download", 200, True),
        # Other successful reads: skipped (page loads, lists, polling, photos).
        ("GET", "/auth/user", 200, False),
        ("GET", "/projects", 200, False),
        ("GET", "/documents", 200, False),
        ("GET", "/projects/{project_id}/photos/{photo_id}/file", 200, False),
        ("HEAD", "/projects", 200, False),
        # Failed or denied reads: always (probing).
        ("GET", "/team", 403, True),
        ("GET", "/projects/{project_id}", 404, True),
        ("GET", "/wp-admin", 404, True),
        ("GET", "/team", 500, True),
    ],
)
def test_should_record(method, route, status, recorded):
    assert should_record(method, route, status) is recorded


# ── Middleware ────────────────────────────────────────────────────────────────


async def test_document_upload_and_view_are_recorded(auth_client, db, test_user):
    test_user.name = "Sam Builder"
    await db.commit()
    user_id, email = test_user.id, test_user.email
    doc_id = await upload_doc(auth_client, "Audit doc", f"audit {uuid.uuid4()}")
    resp = await auth_client.get(
        f"/documents/{doc_id}", headers={"User-Agent": "audit-test"}
    )
    assert resp.status_code == 200

    upload, view = await _events(db, actor_user_id=user_id)
    assert (upload.method, upload.route, upload.status_code) == (
        "POST",
        "/documents",
        202,
    )
    assert upload.project_id == TEST_PROJECT_ID  # from the form, not the URL

    assert view.method == "GET"
    assert view.route == "/documents/{document_id}"
    assert view.status_code == 200
    assert view.outcome == "success"
    assert view.actor_email == email
    assert view.actor_name == "Sam Builder"
    assert view.actor_role == "builder"
    assert (view.entity_type, view.entity_id) == ("document", str(doc_id))
    assert view.user_agent == "audit-test"
    assert view.ip_address
    assert view.duration_ms >= 0
    assert view.details == {}


async def test_successful_page_loads_and_lists_are_not_recorded(
    admin_client, db, admin_user
):
    admin_id = admin_user.id
    for path in ["/auth/user", "/projects", f"/projects/{TEST_PROJECT_ID}", "/team"]:
        assert (await admin_client.get(path)).status_code == 200
    assert await _events(db, actor_user_id=admin_id) == []


async def test_forbidden_is_recorded_as_denied(auth_client, db, test_user):
    user_id = test_user.id
    resp = await auth_client.get("/team")  # admin only
    assert resp.status_code == 403

    [event] = await _events(db, actor_user_id=user_id)
    assert (event.route, event.status_code, event.outcome) == ("/team", 403, "denied")


async def test_not_found_is_recorded_as_denied(auth_client, db, test_user):
    user_id = test_user.id
    resp = await auth_client.get(f"/projects/{UNKNOWN_PROJECT_ID}")
    assert resp.status_code == 404

    [event] = await _events(db, actor_user_id=user_id)
    assert event.outcome == "denied"
    assert event.project_id == UNKNOWN_PROJECT_ID


async def test_failed_login_records_email_but_not_password(client, db):
    email = f"nobody+{uuid.uuid4().hex[:8]}@example.com"
    resp = await client.post(
        "/auth/login", json={"email": email, "password": "secret-pw"}
    )
    assert resp.status_code == 401

    events = await _events(db, route="/auth/login", outcome="denied")
    [event] = [e for e in events if e.details.get("email") == email]
    assert event.details == {"email": email}
    assert event.actor_user_id is None
    assert "secret-pw" not in str(event.details)


async def test_successful_login_records_the_user(client, db, test_user):
    user_id = test_user.id
    resp = await client.post(
        "/auth/login", json={"email": test_user.email, "password": "password"}
    )
    assert resp.status_code == 200

    [event] = await _events(db, actor_user_id=user_id, route="/auth/login")
    assert event.outcome == "success"
    assert event.actor_role == "builder"


async def test_unhandled_exception_is_recorded_as_error(admin_cookies, db, admin_user):
    admin_id = admin_user.id
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
        cookies=admin_cookies,
    ) as c:
        with patch(
            "app.routers.team.get_memberships", side_effect=RuntimeError("boom")
        ):
            resp = await c.get("/team")
    assert resp.status_code == 500

    [event] = await _events(db, actor_user_id=admin_id)
    assert (event.route, event.status_code, event.outcome) == ("/team", 500, "error")


async def test_health_and_options_are_not_recorded(client, db):
    await client.get("/health")
    await client.options(
        "/projects",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert await _events(db, route="/health") == []
    assert await _events(db, method="OPTIONS") == []


async def test_failing_writer_does_not_break_the_response(auth_client):
    with patch.object(writers, "write", side_effect=RuntimeError("db down")):
        resp = await auth_client.post("/auth/logout")
    assert resp.status_code == 204


async def test_role_change_records_old_and_new_role(admin_client, db, admin_user):
    """Endpoints add details via request.state.audit_details."""
    admin_id = admin_user.id
    other = (
        await admin_client.post(
            "/team",
            json={
                "email": f"role+{uuid.uuid4().hex[:8]}@example.com",
                "password": "Password123!",
                "role": "client",
            },
        )
    ).json()
    resp = await admin_client.patch(f"/team/{other['id']}", json={"role": "builder"})
    assert resp.status_code == 200

    [created] = await _events(db, actor_user_id=admin_id, method="POST", route="/team")
    assert created.details["role"] == "client"
    assert created.details["user_id"] == other["id"]
    [changed] = await _events(db, actor_user_id=admin_id, route="/team/{user_id}")
    assert changed.details == {"old_role": "client", "new_role": "builder"}
    assert (changed.entity_type, changed.entity_id) == ("user", other["id"])

    await db.execute(text("DELETE FROM users WHERE id = :id"), {"id": other["id"]})
    await db.commit()


# ── DB writer + append-only trigger ───────────────────────────────────────────


async def _write_row(marker: str) -> None:
    await writers.DbAuditWriter().write(
        {
            "method": "GET",
            "route": "/test",
            "status_code": 200,
            "outcome": "success",
            "duration_ms": 1,
            "details": {"marker": marker},
        }
    )


async def test_db_writer_inserts_a_row(db):
    marker = uuid.uuid4().hex
    await _write_row(marker)
    rows = (
        (
            await db.execute(
                select(AuditEvent).where(AuditEvent.details["marker"].astext == marker)
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 1


@pytest.mark.parametrize(
    "statement",
    [
        "UPDATE audit_events SET route = 'x' WHERE details->>'marker' = :m",
        "DELETE FROM audit_events WHERE details->>'marker' = :m",
    ],
)
async def test_trigger_rejects_update_and_delete(db, statement):
    marker = uuid.uuid4().hex
    await _write_row(marker)
    with pytest.raises(DBAPIError, match="append-only"):
        await db.execute(text(statement), {"m": marker})
    await db.rollback()


async def test_trigger_rejects_truncate(db):
    with pytest.raises(DBAPIError, match="append-only"):
        await db.execute(text("TRUNCATE audit_events"))
    await db.rollback()


# ── File backend (local development) ─────────────────────────────────────────


async def test_file_backend_appends_json_lines_and_skips_the_db(
    auth_client, db, test_user, tmp_path, monkeypatch
):
    from app.config import settings

    user_id = test_user.id
    log = tmp_path / "audit.log"
    monkeypatch.setattr(settings, "audit_backend", "file")
    monkeypatch.setattr(settings, "audit_file_path", str(log))

    await auth_client.get(f"/projects/{TEST_PROJECT_ID}")  # successful read: skipped
    await auth_client.get(f"/projects/{UNKNOWN_PROJECT_ID}")
    await auth_client.get("/team")

    lines = [json.loads(line) for line in log.read_text().splitlines()]
    assert [(e["method"], e["route"], e["outcome"]) for e in lines] == [
        ("GET", "/projects/{project_id}", "denied"),
        ("GET", "/team", "denied"),
    ]
    assert lines[0]["actor_user_id"] == str(user_id)
    assert lines[0]["project_id"] == UNKNOWN_PROJECT_ID
    assert "T" in lines[0]["created_at"]  # ISO 8601
    assert await _events(db, actor_user_id=user_id) == []
