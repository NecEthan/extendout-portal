"""Integration tests for the projects router."""

from tests.fixtures.auth import TEST_PROJECT_ID


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
    assert body["health"] == "On track"


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
    response = await auth_client.get("/projects/does-not-exist")
    assert response.status_code == 404


async def test_get_project_requires_auth(client):
    response = await client.get(f"/projects/{TEST_PROJECT_ID}")
    assert response.status_code == 401
