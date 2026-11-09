"""Integration tests for the documents router.

Fixtures are in fixtures/. Requires postgres (docker compose up -d postgres).
MinIO and Redis are mocked — no external services needed beyond the DB.
"""

import uuid
from unittest.mock import patch

import pytest

from sqlalchemy import select, update

from app.models.base import Document, DocumentVersion, ProcessingJob
from tests.fixtures.auth import TEST_PROJECT_ID, UNKNOWN_PROJECT_ID
from tests.helpers.files import XLSX_CT, docx_upload, make_xlsx


def _docx_file(name: str = "test.docx") -> dict:
    return docx_upload(name, "Hello KnowledgeGuard")


async def test_upload_requires_auth(client):
    response = await client.post(
        "/documents",
        files=_docx_file(),
        data={"title": "Doc", "project_id": TEST_PROJECT_ID},
    )
    assert response.status_code == 401


@pytest.mark.parametrize(
    "filename,content,mime",
    [
        ("notes.txt", b"Plain text notes", "text/plain"),
        ("notes.md", b"# Markdown notes", "text/markdown"),
    ],
)
async def test_upload_rejects_text_files(auth_client, filename, content, mime):
    response = await auth_client.post(
        "/documents",
        files={"file": (filename, content, mime)},
        data={"title": "Text", "project_id": TEST_PROJECT_ID},
    )
    assert response.status_code == 415


async def test_upload_accepts_xlsx(auth_client):
    with (
        patch("app.services.storage.upload_bytes"),
        patch("arq.connections.ArqRedis.enqueue_job"),
    ):
        response = await auth_client.post(
            "/documents",
            files={"file": ("costs.xlsx", make_xlsx([["Beam", 450]]), XLSX_CT)},
            data={"title": "Costs", "project_id": TEST_PROJECT_ID},
        )
    assert response.status_code == 202


async def test_upload_unsupported_file_type(auth_client):
    response = await auth_client.post(
        "/documents",
        files={"file": ("evil.exe", b"\x4d\x5a\x00\x00", "application/octet-stream")},
        data={"title": "Bad file", "project_id": TEST_PROJECT_ID},
    )
    assert response.status_code == 415


async def test_upload_creates_db_records(auth_client, db, test_user):
    with (
        patch("app.services.storage.upload_bytes"),
        patch("app.services.storage.delete_object"),
    ):
        response = await auth_client.post(
            "/documents",
            files=_docx_file(),
            data={"title": "My Doc", "project_id": TEST_PROJECT_ID},
        )

    assert response.status_code == 202
    doc_id = response.json()["id"]

    result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
    doc = result.scalar_one_or_none()
    assert doc is not None
    assert doc.title == "My Doc"
    assert doc.owner_id == test_user.id

    result = await db.execute(
        select(DocumentVersion).where(DocumentVersion.document_id == doc.id)
    )
    version = result.scalar_one_or_none()
    assert version is not None
    assert version.status == "PROCESSING"

    result = await db.execute(
        select(ProcessingJob).where(ProcessingJob.document_version_id == version.id)
    )
    job = result.scalar_one_or_none()
    assert job is not None
    assert job.status in ("QUEUED", "DISPATCHED")


async def test_upload_enqueues_job(auth_client, mock_pool):
    with (
        patch("app.services.storage.upload_bytes"),
        patch("app.services.storage.delete_object"),
    ):
        response = await auth_client.post(
            "/documents",
            files=_docx_file(),
            data={"title": "Enqueue test", "project_id": TEST_PROJECT_ID},
        )

    assert response.status_code == 202
    mock_pool.enqueue_job.assert_called_once()
    assert mock_pool.enqueue_job.call_args.args[0] == "process_document"


async def test_list_documents(auth_client):
    with (
        patch("app.services.storage.upload_bytes"),
        patch("app.services.storage.delete_object"),
    ):
        await auth_client.post(
            "/documents",
            files=_docx_file(),
            data={"title": "Listed Doc", "project_id": TEST_PROJECT_ID},
        )

    response = await auth_client.get("/documents")
    assert response.status_code == 200
    titles = [d["title"] for d in response.json()["items"]]
    assert "Listed Doc" in titles


async def test_delete_document(auth_client, db):
    with (
        patch("app.services.storage.upload_bytes"),
        patch("app.services.storage.delete_object"),
    ):
        upload = await auth_client.post(
            "/documents",
            files=_docx_file(),
            data={"title": "To Delete", "project_id": TEST_PROJECT_ID},
        )
    doc_id = upload.json()["id"]

    response = await auth_client.delete(f"/documents/{doc_id}")
    assert response.status_code == 204

    db.expire_all()
    result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
    assert result.scalar_one_or_none() is None


async def test_upload_requires_project(auth_client):
    with patch("app.services.storage.upload_bytes"):
        response = await auth_client.post(
            "/documents", files=_docx_file(), data={"title": "No project"}
        )
    assert response.status_code == 422


async def test_upload_unknown_project_404(auth_client):
    with patch("app.services.storage.upload_bytes"):
        response = await auth_client.post(
            "/documents",
            files=_docx_file(),
            data={"title": "Ghost", "project_id": str(UNKNOWN_PROJECT_ID)},
        )
    assert response.status_code == 404


async def test_non_member_cannot_upload(auth_client, make_project):
    outsider_project = await make_project(member=None)
    with patch("app.services.storage.upload_bytes"):
        response = await auth_client.post(
            "/documents",
            files=_docx_file(),
            data={"title": "Intruder", "project_id": outsider_project},
        )
    assert response.status_code == 403


async def test_admin_can_upload_to_any_project(admin_client, make_project):
    outsider_project = await make_project(member=None)
    with (
        patch("app.services.storage.upload_bytes"),
        patch("app.services.storage.delete_object"),
    ):
        response = await admin_client.post(
            "/documents",
            files=_docx_file(),
            data={"title": "Admin Upload", "project_id": outsider_project},
        )
    assert response.status_code == 202


async def test_non_member_cannot_list_project(auth_client, make_project):
    outsider_project = await make_project(member=None)
    response = await auth_client.get("/documents", params={"project_id": outsider_project})
    assert response.status_code == 403


async def test_user_only_sees_member_project_docs(auth_client, admin_client, make_project):
    outsider_project = await make_project(member=None)
    with (
        patch("app.services.storage.upload_bytes"),
        patch("app.services.storage.delete_object"),
    ):
        await admin_client.post(
            "/documents",
            files=docx_upload("in.docx", "member project doc"),
            data={"title": "Member Visible", "project_id": TEST_PROJECT_ID},
        )
        await admin_client.post(
            "/documents",
            files=docx_upload("out.docx", "outsider project doc"),
            data={"title": "Hidden From Members", "project_id": outsider_project},
        )

    titles = [d["title"] for d in (await auth_client.get("/documents")).json()["items"]]
    assert "Member Visible" in titles
    assert "Hidden From Members" not in titles


async def test_admin_sees_all_project_docs(admin_client, make_project):
    outsider_project = await make_project(member=None)
    with (
        patch("app.services.storage.upload_bytes"),
        patch("app.services.storage.delete_object"),
    ):
        await admin_client.post(
            "/documents",
            files=_docx_file(),
            data={"title": "Admin Visible", "project_id": outsider_project},
        )

    response = await admin_client.get("/documents", params={"project_id": outsider_project})
    assert response.status_code == 200
    assert [d["title"] for d in response.json()["items"]] == ["Admin Visible"]


async def test_upload_duplicate_content_rejected(auth_client):
    with (
        patch("app.services.storage.upload_bytes"),
        patch("app.services.storage.delete_object"),
    ):
        first = await auth_client.post(
            "/documents",
            files=_docx_file(),
            data={"title": "Original", "project_id": TEST_PROJECT_ID},
        )
        assert first.status_code == 202

        second = await auth_client.post(
            "/documents",
            files=_docx_file(),
            data={"title": "Duplicate", "project_id": TEST_PROJECT_ID},
        )
    assert second.status_code == 409


async def test_upload_sets_project_id_on_version(auth_client, db):
    with patch("app.services.storage.upload_bytes"):
        response = await auth_client.post(
            "/documents",
            files=docx_upload("p.docx", f"Project id check {uuid.uuid4()}"),
            data={"title": "P", "project_id": TEST_PROJECT_ID},
        )
    assert response.status_code == 202

    result = await db.execute(
        select(DocumentVersion).where(
            DocumentVersion.document_id == uuid.UUID(response.json()["id"])
        )
    )
    assert result.scalar_one().project_id == TEST_PROJECT_ID


async def test_same_file_can_be_reuploaded_after_failed_processing(auth_client, db):
    """A FAILED version doesn't count as a duplicate, so the user can retry."""
    files = docx_upload("retry.docx", f"Retry after failure {uuid.uuid4()}")
    with (
        patch("app.services.storage.upload_bytes"),
        patch("app.services.storage.delete_object"),
    ):
        first = await auth_client.post(
            "/documents",
            files=files,
            data={"title": "Retry", "project_id": TEST_PROJECT_ID},
        )
        assert first.status_code == 202
        await db.execute(
            update(DocumentVersion)
            .where(DocumentVersion.document_id == uuid.UUID(first.json()["id"]))
            .values(status="FAILED")
        )
        await db.commit()

        retry = await auth_client.post(
            "/documents",
            files=files,
            data={"title": "Retry", "project_id": TEST_PROJECT_ID},
        )

    assert retry.status_code == 202


async def test_concurrent_duplicate_upload_rejected_by_unique_index(auth_client):
    """Two identical uploads that both pass the code check: the DB index rejects one."""
    files = docx_upload("race.docx", f"Race {uuid.uuid4()}")
    with (
        patch("app.services.storage.upload_bytes"),
        patch("app.services.storage.delete_object") as delete_object,
        # Simulate the race: neither upload sees the other in the code check.
        patch("app.routers.documents.documents.assert_no_duplicate"),
    ):
        first = await auth_client.post(
            "/documents",
            files=files,
            data={"title": "Race", "project_id": TEST_PROJECT_ID},
        )
        second = await auth_client.post(
            "/documents",
            files=files,
            data={"title": "Race", "project_id": TEST_PROJECT_ID},
        )

    assert first.status_code == 202
    assert second.status_code == 409
    assert second.json()["detail"] == "Document with identical content already exists"
    delete_object.assert_called_once()  # the losing upload's file is cleaned up


async def test_list_documents_filtered_by_project(auth_client, make_project, test_user):
    other_project = await make_project(member=test_user)
    with (
        patch("app.services.storage.upload_bytes"),
        patch("app.services.storage.delete_object"),
    ):
        await auth_client.post(
            "/documents",
            files=docx_upload("a.docx", "Project A content"),
            data={"title": "Doc A", "project_id": TEST_PROJECT_ID},
        )
        await auth_client.post(
            "/documents",
            files=docx_upload("b.docx", "Project B content"),
            data={"title": "Doc B", "project_id": other_project},
        )

    response = await auth_client.get("/documents", params={"project_id": TEST_PROJECT_ID})
    assert response.status_code == 200
    body = response.json()
    titles = [d["title"] for d in body["items"]]
    assert "Doc A" in titles
    assert "Doc B" not in titles
    assert all(d["project_id"] == TEST_PROJECT_ID for d in body["items"])
    assert body["total"] == len(body["items"])


async def test_same_content_allowed_in_different_projects(
    auth_client, make_project, test_user
):
    other_project = await make_project(member=test_user)
    with (
        patch("app.services.storage.upload_bytes"),
        patch("app.services.storage.delete_object"),
    ):
        first = await auth_client.post(
            "/documents",
            files=_docx_file(),
            data={"title": "Spec", "project_id": TEST_PROJECT_ID},
        )
        other = await auth_client.post(
            "/documents",
            files=_docx_file(),
            data={"title": "Spec", "project_id": other_project},
        )
        same = await auth_client.post(
            "/documents",
            files=_docx_file(),
            data={"title": "Spec", "project_id": TEST_PROJECT_ID},
        )

    assert first.status_code == 202
    assert other.status_code == 202
    assert same.status_code == 409
