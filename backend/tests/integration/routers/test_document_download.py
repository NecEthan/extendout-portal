"""GET /documents/{id}/download: the ACTIVE version's original file."""

import uuid
from unittest.mock import patch

from sqlalchemy import select, update

from app.models.base import DocumentVersion
from tests.fixtures.auth import TEST_PROJECT_ID
from tests.helpers.files import DOCX_CT, make_docx, with_macros

TEXT = "Loft conversion drawings"


async def _upload(client, title="Loft plan", project_id=TEST_PROJECT_ID) -> str:
    with patch("app.services.storage.upload_bytes"):
        r = await client.post(
            "/documents",
            files={"file": ("plan.docx", make_docx(TEXT), DOCX_CT)},
            data={"title": title, "project_id": str(project_id)},
        )
    assert r.status_code == 202
    return r.json()["id"]


async def _activate(db, document_id: str) -> None:
    await db.execute(
        update(DocumentVersion)
        .where(DocumentVersion.document_id == uuid.UUID(document_id))
        .values(status="ACTIVE")
    )
    await db.commit()


async def _download(client, document_id: str, content: bytes | None = None):
    with patch(
        "app.services.storage.download_bytes",
        return_value=content if content is not None else make_docx(TEXT),
    ) as download:
        response = await client.get(f"/documents/{document_id}/download")
    return response, download


async def test_member_downloads_active_version(auth_client, db):
    doc_id = await _upload(auth_client)
    await _activate(db, doc_id)
    storage_key = (
        await db.execute(
            select(DocumentVersion.storage_key).where(
                DocumentVersion.document_id == uuid.UUID(doc_id)
            )
        )
    ).scalar_one()

    response, download = await _download(auth_client, doc_id)

    assert response.status_code == 200
    assert response.content == make_docx(TEXT)
    download.assert_called_once_with(storage_key)
    assert response.headers["content-type"] == DOCX_CT
    assert response.headers["content-disposition"] == (
        "attachment; filename=\"Loft plan.docx\"; filename*=UTF-8''Loft%20plan.docx"
    )
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in response.headers["content-security-policy"]
    assert response.headers["cache-control"] == "private, no-store"


async def test_filename_is_safe_for_odd_titles(auth_client, db):
    doc_id = await _upload(auth_client, title='Plan "v2"\\..\\/etc é.docx')
    await _activate(db, doc_id)

    response, _ = await _download(auth_client, doc_id)

    header = response.headers["content-disposition"]
    assert header.startswith('attachment; filename="Plan _v2__..__etc _.docx";')
    assert "\r" not in header and "\n" not in header


async def test_cannot_download_while_processing(auth_client):
    doc_id = await _upload(auth_client)  # still PROCESSING

    response, download = await _download(auth_client, doc_id)

    assert response.status_code == 409
    download.assert_not_called()


async def test_list_says_whether_a_version_can_be_downloaded(auth_client, db):
    doc_id = await _upload(auth_client)

    def flag(body):
        return next(d for d in body["items"] if d["id"] == doc_id)["has_active_version"]

    params = {"project_id": TEST_PROJECT_ID}
    assert flag((await auth_client.get("/documents", params=params)).json()) is False
    await _activate(db, doc_id)
    assert flag((await auth_client.get("/documents", params=params)).json()) is True


async def test_stored_macro_file_is_refused(auth_client, db):
    """A file stored before the macro check existed is never handed out."""
    doc_id = await _upload(auth_client)
    await _activate(db, doc_id)

    response, _ = await _download(auth_client, doc_id, with_macros(make_docx(TEXT)))

    assert response.status_code == 409


async def test_storage_down_returns_503(auth_client, db):
    doc_id = await _upload(auth_client)
    await _activate(db, doc_id)

    with patch("app.services.storage.download_bytes", side_effect=RuntimeError("down")):
        response = await auth_client.get(f"/documents/{doc_id}/download")

    assert response.status_code == 503


async def test_non_member_gets_404(auth_client, admin_client, db, make_project):
    outsider_project = await make_project(member=None)
    doc_id = await _upload(admin_client, project_id=outsider_project)
    await _activate(db, doc_id)

    response, download = await _download(auth_client, doc_id)

    assert response.status_code == 404
    download.assert_not_called()


async def test_admin_downloads_from_any_project(admin_client, db, make_project):
    outsider_project = await make_project(member=None)
    doc_id = await _upload(admin_client, project_id=outsider_project)
    await _activate(db, doc_id)

    response, _ = await _download(admin_client, doc_id)

    assert response.status_code == 200


async def test_unknown_document_404(auth_client):
    response, _ = await _download(auth_client, str(uuid.uuid4()))
    assert response.status_code == 404


async def test_download_requires_auth(client):
    response = await client.get(f"/documents/{uuid.uuid4()}/download")
    assert response.status_code == 401
