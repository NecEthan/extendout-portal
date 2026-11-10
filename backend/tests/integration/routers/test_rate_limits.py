"""Rate limiting: per-user uploads and queries, per-IP login, global backstop.

Limits are callables reading ``settings``, so each test lowers them to a small
number and resets the limiter's Redis counters before and after.
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.config import settings
from app.limiter import limiter
from tests.fixtures.auth import TEST_PROJECT_ID
from tests.helpers.files import docx_upload


@pytest.fixture(autouse=True)
def low_limits(monkeypatch):
    monkeypatch.setattr(settings, "upload_rate_limit", "2/minute")
    monkeypatch.setattr(settings, "query_rate_limit", "2/minute")
    monkeypatch.setattr(settings, "login_rate_limit", "2/minute")
    monkeypatch.setattr(settings, "global_rate_limit", "3/minute")
    limiter.reset()
    yield
    limiter.reset()


def _unique_docx() -> dict:
    # Unique content so the duplicate-file check (409) never kicks in.
    content = f"Site notes {uuid.uuid4()}"
    return docx_upload("notes.docx", content)


async def _upload(client):
    return await client.post(
        "/documents",
        files=_unique_docx(),
        data={"title": "Notes", "project_id": TEST_PROJECT_ID},
    )


@pytest.fixture
def no_storage():
    with (
        patch("app.services.storage.upload_bytes"),
        patch("app.services.storage.delete_object"),
    ):
        yield


# ── Uploads: per user, documents + versions share one bucket ─────────────────


async def test_upload_limit_is_per_user(auth_client, admin_client, no_storage):
    assert (await _upload(auth_client)).status_code == 202
    assert (await _upload(auth_client)).status_code == 202

    blocked = await _upload(auth_client)
    assert blocked.status_code == 429
    assert blocked.json()["detail"].startswith("Rate limit exceeded")

    # A different user has their own budget.
    assert (await _upload(admin_client)).status_code == 202


async def test_new_versions_share_the_upload_limit(auth_client, no_storage):
    doc_id = (await _upload(auth_client)).json()["id"]

    new_version = await auth_client.post(
        f"/documents/{doc_id}/versions", files=_unique_docx()
    )
    assert new_version.status_code == 202

    # Third upload of either kind is over the shared 2/minute.
    blocked = await auth_client.post(
        f"/documents/{doc_id}/versions", files=_unique_docx()
    )
    assert blocked.status_code == 429


# ── Query: per user ───────────────────────────────────────────────────────────


async def test_query_limit_is_per_user(
    auth_client, admin_client, test_user, make_project
):
    # An empty project: no chunks found, so no LLM call is made.
    project = await make_project(member=test_user)
    fake_embedding = AsyncMock(return_value=[[0.0] * 1536])
    body = {"question": "What U-value are the rooflights?", "project_id": project}

    with patch("app.routers.query.generate_embeddings", new=fake_embedding):
        assert (await auth_client.post("/query", json=body)).status_code == 200
        assert (await auth_client.post("/query", json=body)).status_code == 200
        assert (await auth_client.post("/query", json=body)).status_code == 429

        assert (await admin_client.post("/query", json=body)).status_code == 200


# ── Login: still per IP ───────────────────────────────────────────────────────


async def test_login_limit_is_per_ip_across_emails(client):
    def attempt():
        return client.post(
            "/auth/login",
            json={"email": f"{uuid.uuid4().hex}@example.com", "password": "Wrong1234"},
        )

    assert (await attempt()).status_code == 401
    assert (await attempt()).status_code == 401
    # Different email again, same IP: blocked.
    assert (await attempt()).status_code == 429


# ── Global backstop ───────────────────────────────────────────────────────────


async def test_backstop_limits_other_routes(auth_client):
    for _ in range(3):
        assert (await auth_client.get("/projects")).status_code == 200
    blocked = await auth_client.get("/projects")
    assert blocked.status_code == 429
    assert blocked.json()["detail"].startswith("Rate limit exceeded")


async def test_health_is_never_limited(client):
    for _ in range(10):
        assert (await client.get("/health")).status_code == 200
