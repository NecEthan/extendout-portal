"""Integration tests for the team router and project membership endpoints."""

import uuid

import pytest
from sqlalchemy import delete

from app.models.base import ProjectMember, User
from app.services.auth import hash_password
from tests.fixtures.auth import TEST_PROJECT_ID


@pytest.fixture
async def make_user(db):
    """Factory: make_user(role, projects=[...]) -> User. Cleaned up afterwards."""
    created: list[uuid.UUID] = []

    async def _make(role: str = "client", projects: tuple[str, ...] = ()) -> User:
        user = User(
            email=f"team+{uuid.uuid4().hex[:8]}@example.com",
            name=f"Team {role}",
            password_hash=await hash_password("password"),
            role=role,
        )
        db.add(user)
        await db.flush()
        for project_id in projects:
            db.add(ProjectMember(project_id=project_id, user_id=user.id))
        await db.commit()
        await db.refresh(user)
        created.append(user.id)
        return user

    yield _make

    if created:
        await db.execute(delete(User).where(User.id.in_(created)))
        await db.commit()


# ── GET /team ─────────────────────────────────────────────────────────────────


async def test_team_requires_auth(client):
    assert (await client.get("/team")).status_code == 401


async def test_non_admin_cannot_list_team(auth_client):
    assert (await auth_client.get("/team")).status_code == 403


async def test_admin_sees_everyone_with_projects(admin_client, make_user, make_project):
    other_project = await make_project(member=None)
    loner = await make_user("client")
    member = await make_user("builder", projects=(TEST_PROJECT_ID, other_project))

    by_id = {m["id"]: m for m in (await admin_client.get("/team")).json()}
    assert by_id[str(loner.id)]["project_ids"] == []
    assert by_id[str(member.id)]["project_ids"] == sorted(
        [TEST_PROJECT_ID, other_project]
    )


# ── PATCH /team/{user_id} ─────────────────────────────────────────────────────


async def test_admin_changes_role(admin_client, make_user):
    user = await make_user("client")
    response = await admin_client.patch(f"/team/{user.id}", json={"role": "builder"})
    assert response.status_code == 200
    assert response.json()["role"] == "builder"


async def test_admin_cannot_change_own_role(admin_client, admin_user):
    response = await admin_client.patch(
        f"/team/{admin_user.id}", json={"role": "client"}
    )
    assert response.status_code == 400


async def test_invalid_role_rejected(admin_client, make_user):
    user = await make_user("client")
    response = await admin_client.patch(f"/team/{user.id}", json={"role": "owner"})
    assert response.status_code == 422


async def test_non_admin_cannot_change_role(auth_client, make_user):
    user = await make_user("client")
    response = await auth_client.patch(f"/team/{user.id}", json={"role": "admin"})
    assert response.status_code == 403


async def test_change_role_unknown_user(admin_client):
    response = await admin_client.patch(
        f"/team/{uuid.uuid4()}", json={"role": "client"}
    )
    assert response.status_code == 404


# ── Project members ───────────────────────────────────────────────────────────


async def test_non_admin_cannot_list_project_members(auth_client):
    response = await auth_client.get(f"/projects/{TEST_PROJECT_ID}/members")
    assert response.status_code == 403


async def test_admin_lists_project_members(admin_client, test_user):
    response = await admin_client.get(f"/projects/{TEST_PROJECT_ID}/members")
    assert response.status_code == 200
    assert str(test_user.id) in [m["id"] for m in response.json()]


async def test_list_members_unknown_project(admin_client):
    response = await admin_client.get("/projects/does-not-exist/members")
    assert response.status_code == 404


async def test_admin_adds_and_removes_member(admin_client, make_user, make_project):
    project = await make_project(member=None)
    user = await make_user("builder")

    added = await admin_client.post(
        f"/projects/{project}/members", json={"user_id": str(user.id)}
    )
    assert added.status_code == 201
    assert added.json()["id"] == str(user.id)

    duplicate = await admin_client.post(
        f"/projects/{project}/members", json={"user_id": str(user.id)}
    )
    assert duplicate.status_code == 409

    members = (await admin_client.get(f"/projects/{project}/members")).json()
    assert [m["id"] for m in members] == [str(user.id)]

    removed = await admin_client.delete(f"/projects/{project}/members/{user.id}")
    assert removed.status_code == 204
    assert (await admin_client.get(f"/projects/{project}/members")).json() == []

    again = await admin_client.delete(f"/projects/{project}/members/{user.id}")
    assert again.status_code == 404


async def test_add_member_unknown_user_or_project(admin_client, make_project):
    project = await make_project(member=None)
    unknown_user = await admin_client.post(
        f"/projects/{project}/members", json={"user_id": str(uuid.uuid4())}
    )
    assert unknown_user.status_code == 404

    unknown_project = await admin_client.post(
        "/projects/does-not-exist/members", json={"user_id": str(uuid.uuid4())}
    )
    assert unknown_project.status_code == 404


async def test_non_admin_cannot_manage_members(auth_client, make_user):
    user = await make_user("client")
    add = await auth_client.post(
        f"/projects/{TEST_PROJECT_ID}/members", json={"user_id": str(user.id)}
    )
    assert add.status_code == 403
    remove = await auth_client.delete(f"/projects/{TEST_PROJECT_ID}/members/{user.id}")
    assert remove.status_code == 403


# ── Registration with a name ──────────────────────────────────────────────────


async def test_register_stores_name(client, db):
    email = f"named+{uuid.uuid4().hex[:8]}@example.com"
    response = await client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "Password123",
            "role": "client",
            "name": " Ada ",
        },
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Ada"

    await db.execute(delete(User).where(User.email == email))
    await db.commit()
