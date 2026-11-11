"""Integration tests for the projects router."""

import io
from unittest.mock import patch

import pytest
from PIL import Image
from sqlalchemy import delete, select

from app.models.base import (
    Document,
    DocumentChunk,
    DocumentVersion,
    ProcessingJob,
    Project,
    ProjectMember,
    ProjectPhoto,
)
from tests.fixtures.auth import TEST_PROJECT_ID, UNKNOWN_PROJECT_ID
from tests.helpers.files import docx_upload


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


# ── DELETE /projects/{id} ─────────────────────────────────────────────────────


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), (0, 0, 255)).save(buf, format="PNG")
    return buf.getvalue()


async def _fill_project(admin_client, db, project_id: int) -> None:
    """Give the project a document (with a chunk) and a photo."""
    with patch("app.services.storage.upload_bytes"):
        doc = await admin_client.post(
            "/documents",
            files=docx_upload("plan.docx", "Loft plan"),
            data={"title": "Plan", "project_id": str(project_id)},
        )
        assert doc.status_code == 202
        photo = await admin_client.post(
            f"/projects/{project_id}/photos",
            files={"file": ("site.png", _png(), "image/png")},
        )
        assert photo.status_code == 201
    version_id = (
        await db.execute(
            select(DocumentVersion.id).where(DocumentVersion.project_id == project_id)
        )
    ).scalar_one()
    db.add(
        DocumentChunk(
            document_version_id=version_id, chunk_index=0, content="x", token_count=1
        )
    )
    await db.commit()


async def _count(db, model, where) -> int:
    return len((await db.execute(select(model).where(where))).scalars().all())


async def test_admin_deletes_project_and_everything_in_it(
    admin_client, db, make_project, test_user
):
    project = await make_project(member=test_user)
    await _fill_project(admin_client, db, project)
    keys = set(
        (
            await db.execute(
                select(DocumentVersion.storage_key).where(
                    DocumentVersion.project_id == project
                )
            )
        ).scalars()
    ) | set(
        (
            await db.execute(
                select(ProjectPhoto.storage_key).where(
                    ProjectPhoto.project_id == project
                )
            )
        ).scalars()
    )
    version_ids = select(DocumentVersion.id).where(
        DocumentVersion.project_id == project
    )

    with patch("app.services.storage.delete_object") as delete_object:
        response = await admin_client.delete(f"/projects/{project}")

    assert response.status_code == 204
    db.expire_all()
    assert await db.get(Project, project) is None
    assert await _count(db, Document, Document.project_id == project) == 0
    assert await _count(db, DocumentVersion, DocumentVersion.project_id == project) == 0
    assert await _count(db, ProjectPhoto, ProjectPhoto.project_id == project) == 0
    assert await _count(db, ProjectMember, ProjectMember.project_id == project) == 0
    assert (
        await _count(
            db, DocumentChunk, DocumentChunk.document_version_id.in_(version_ids)
        )
        == 0
    )
    assert (
        await _count(
            db, ProcessingJob, ProcessingJob.document_version_id.in_(version_ids)
        )
        == 0
    )
    assert {c.args[0] for c in delete_object.call_args_list} == keys
    assert len(keys) == 2

    assert (await admin_client.get(f"/projects/{project}")).status_code == 404


async def test_delete_project_leaves_other_projects_alone(
    admin_client, db, make_project
):
    doomed = await make_project(member=None)
    kept = await make_project(member=None)
    await _fill_project(admin_client, db, kept)

    with patch("app.services.storage.delete_object") as delete_object:
        response = await admin_client.delete(f"/projects/{doomed}")

    assert response.status_code == 204
    delete_object.assert_not_called()
    db.expire_all()
    assert await db.get(Project, kept) is not None
    assert await _count(db, Document, Document.project_id == kept) == 1
    assert await _count(db, ProjectPhoto, ProjectPhoto.project_id == kept) == 1
    await db.execute(delete(ProjectPhoto).where(ProjectPhoto.project_id == kept))
    await db.commit()


async def test_delete_project_succeeds_when_storage_is_down(
    admin_client, db, make_project
):
    project = await make_project(member=None)
    await _fill_project(admin_client, db, project)

    with patch("app.services.storage.delete_object", side_effect=RuntimeError("down")):
        response = await admin_client.delete(f"/projects/{project}")

    assert response.status_code == 204
    db.expire_all()
    assert await db.get(Project, project) is None


async def test_delete_unknown_project(admin_client):
    response = await admin_client.delete(f"/projects/{UNKNOWN_PROJECT_ID}")
    assert response.status_code == 404


async def test_non_admin_cannot_delete_project(auth_client, db):
    response = await auth_client.delete(f"/projects/{TEST_PROJECT_ID}")
    assert response.status_code == 403
    db.expire_all()
    assert await db.get(Project, TEST_PROJECT_ID) is not None


async def test_delete_project_requires_auth(client):
    response = await client.delete(f"/projects/{TEST_PROJECT_ID}")
    assert response.status_code == 401
