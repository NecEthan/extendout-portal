"""Integration tests for the projects router."""

import pytest
from sqlalchemy import delete

from app.models.base import Project
from tests.fixtures.auth import TEST_PROJECT_ID, UNKNOWN_PROJECT_ID


@pytest.fixture
async def created_projects(db):
    """Collects ids of projects made via POST /projects and deletes them after."""
    ids: list[int] = []
    yield ids
    if ids:
        await db.execute(delete(Project).where(Project.id.in_(ids)))
        await db.commit()


async def test_list_projects_requires_auth(client):
    response = await client.get("/projects")
    assert response.status_code == 401


async def test_member_only_sees_member_projects(auth_client, make_project):
    outsider_project = await make_project(member=None)

    response = await auth_client.get("/projects")
    assert response.status_code == 200
    ids = [p["id"] for p in response.json()]
    assert TEST_PROJECT_ID in ids
    assert outsider_project not in ids


async def test_admin_sees_all_projects(admin_client, make_project):
    outsider_project = await make_project(member=None)

    response = await admin_client.get("/projects")
    assert response.status_code == 200
    assert outsider_project in [p["id"] for p in response.json()]


async def test_get_project_as_member(auth_client):
    response = await auth_client.get(f"/projects/{TEST_PROJECT_ID}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == TEST_PROJECT_ID
    assert body["name"] == "Test Project"
    # Detail fields fall back to column defaults for a bare project.
    assert body["client"] == ""
    assert body["address"] == ""


async def test_get_project_non_member_forbidden(auth_client, make_project):
    outsider_project = await make_project(member=None)
    response = await auth_client.get(f"/projects/{outsider_project}")
    assert response.status_code == 403


async def test_get_project_admin_any_project(admin_client, make_project):
    outsider_project = await make_project(member=None)
    response = await admin_client.get(f"/projects/{outsider_project}")
    assert response.status_code == 200
    assert response.json()["id"] == outsider_project


async def test_get_project_not_found(auth_client):
    response = await auth_client.get(f"/projects/{UNKNOWN_PROJECT_ID}")
    assert response.status_code == 404


async def test_get_project_requires_auth(client):
    response = await client.get(f"/projects/{TEST_PROJECT_ID}")
    assert response.status_code == 401


# ── POST /projects ────────────────────────────────────────────────────────────


async def test_admin_creates_project(admin_client, created_projects):
    response = await admin_client.post(
        "/projects",
        json={"name": "  New Build  ", "client": "Ada", "address": "1 High St"},
    )
    assert response.status_code == 201
    body = response.json()
    created_projects.append(body["id"])
    assert isinstance(body["id"], int)
    assert body["name"] == "New Build"
    assert body["client"] == "Ada"
    assert body["address"] == "1 High St"

    listed = (await admin_client.get("/projects")).json()
    assert body["id"] in [p["id"] for p in listed]


async def test_created_project_ids_increment(admin_client, created_projects):
    first = (await admin_client.post("/projects", json={"name": "A"})).json()["id"]
    second = (await admin_client.post("/projects", json={"name": "B"})).json()["id"]
    created_projects.extend([first, second])
    assert second == first + 1


async def test_create_project_requires_name(admin_client):
    response = await admin_client.post("/projects", json={"name": "   "})
    assert response.status_code == 422


async def test_non_admin_cannot_create_project(auth_client):
    response = await auth_client.post("/projects", json={"name": "Nope"})
    assert response.status_code == 403


async def test_create_project_requires_auth(client):
    response = await client.post("/projects", json={"name": "Nope"})
    assert response.status_code == 401


# ── PATCH /projects/{id} ──────────────────────────────────────────────────────


async def test_admin_updates_project(admin_client, make_project):
    project = await make_project(member=None)
    response = await admin_client.patch(
        f"/projects/{project}",
        json={"name": " Renamed ", "client": "Ada"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Renamed"
    assert body["client"] == "Ada"
    assert body["address"] == ""  # not sent, so unchanged

    fetched = (await admin_client.get(f"/projects/{project}")).json()
    assert fetched == body


async def test_update_project_validation(admin_client, make_project):
    project = await make_project(member=None)
    for bad in ({"name": "  "}, {"name": None}):
        response = await admin_client.patch(f"/projects/{project}", json=bad)
        assert response.status_code == 422, bad


async def test_update_unknown_project(admin_client):
    response = await admin_client.patch(
        f"/projects/{UNKNOWN_PROJECT_ID}", json={"name": "X"}
    )
    assert response.status_code == 404


async def test_non_admin_cannot_update_project(auth_client):
    response = await auth_client.patch(
        f"/projects/{TEST_PROJECT_ID}", json={"name": "Hijacked"}
    )
    assert response.status_code == 403
