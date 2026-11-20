"""GET /documents/{id}/preview and /preview/pages/{n}: the file parsed on the
server into what the browser shows."""

import uuid
from unittest.mock import patch

from sqlalchemy import update

from app.models.base import DocumentVersion
from tests.fixtures.auth import TEST_PROJECT_ID
from tests.helpers.files import make_docx, make_pdf, make_xlsx, with_macros


async def _upload(client, content: bytes, name: str, project_id=TEST_PROJECT_ID):
    """Upload ``content`` and make it the ACTIVE version."""
    with patch("app.services.storage.upload_bytes"):
        r = await client.post(
            "/documents",
            files={"file": (name, content, "application/octet-stream")},
            data={"title": name, "project_id": str(project_id)},
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


async def _ready(client, db, content: bytes, name: str, **kw) -> str:
    doc_id = await _upload(client, content, name, **kw)
    await _activate(db, doc_id)
    return doc_id


async def _get(client, url: str, content: bytes | None):
    with patch("app.services.storage.download_bytes", return_value=content) as dl:
        return await client.get(url), dl


async def test_pdf_preview_gives_page_sizes(auth_client, db):
    pdf = make_pdf(["one", "two"])
    doc_id = await _ready(auth_client, db, pdf, "plan.pdf")

    r, _ = await _get(auth_client, f"/documents/{doc_id}/preview", pdf)

    assert r.status_code == 200
    assert r.json()["kind"] == "pdf"
    assert r.json()["pages"] == [
        {"width": 595, "height": 842},
        {"width": 595, "height": 842},
    ]
    assert r.headers["cache-control"] == "private, no-store"


async def test_pdf_page_image(auth_client, db):
    pdf = make_pdf(["one", "two"])
    doc_id = await _ready(auth_client, db, pdf, "plan.pdf")

    r, _ = await _get(
        auth_client, f"/documents/{doc_id}/preview/pages/2?width=500", pdf
    )

    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert r.content.startswith(b"\x89PNG")
    assert int.from_bytes(r.content[16:20], "big") == 500
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in r.headers["content-security-policy"]


async def test_pdf_page_errors(auth_client, db):
    pdf = make_pdf(["one"])
    doc_id = await _ready(auth_client, db, pdf, "plan.pdf")
    base = f"/documents/{doc_id}/preview/pages"

    assert (await _get(auth_client, f"{base}/2", pdf))[0].status_code == 404
    assert (await _get(auth_client, f"{base}/0", pdf))[0].status_code == 404
    # Width outside 200–2400.
    assert (await _get(auth_client, f"{base}/1?width=5000", pdf))[0].status_code == 422

    docx = make_docx("not a pdf")
    word_id = await _ready(auth_client, db, docx, "spec.docx")
    r, _ = await _get(auth_client, f"/documents/{word_id}/preview/pages/1", docx)
    assert r.status_code == 409


async def test_word_preview_is_clean_html(auth_client, db):
    docx = make_docx("Loft conversion spec")
    doc_id = await _ready(auth_client, db, docx, "spec.docx")

    r, _ = await _get(auth_client, f"/documents/{doc_id}/preview", docx)

    assert r.status_code == 200
    assert r.json()["kind"] == "docx"
    assert r.json()["html"] == "<p>Loft conversion spec</p>"


async def test_excel_preview_gives_sheets(auth_client, db):
    xlsx = make_xlsx([["Item", "Cost"], ["Beam", 1200]], title="Quote")
    doc_id = await _ready(auth_client, db, xlsx, "quote.xlsx")

    r, _ = await _get(auth_client, f"/documents/{doc_id}/preview", xlsx)

    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "xlsx"
    assert body["sheets"][0]["name"] == "Quote"
    assert body["sheets"][0]["rows"][1] == [
        {"text": "Beam", "numeric": False},
        {"text": "1200", "numeric": True},
    ]


async def test_unreadable_file_asks_to_download(auth_client, db):
    good = make_pdf(["one"])
    doc_id = await _ready(auth_client, db, good, "plan.pdf")

    r, _ = await _get(auth_client, f"/documents/{doc_id}/preview", b"%PDF-1.4 broken")

    assert r.status_code == 409
    assert "Download it" in r.json()["detail"]


async def test_slow_file_gives_up(auth_client, db, monkeypatch):
    from app.routers.documents import preview

    monkeypatch.setattr(preview, "PREVIEW_TIMEOUT_SECONDS", 0.01)

    def slow(_content):
        import time

        time.sleep(0.2)

    monkeypatch.setattr(preview.previews, "xlsx_sheets", slow)
    xlsx = make_xlsx([["x"]])
    doc_id = await _ready(auth_client, db, xlsx, "big.xlsx")

    r, _ = await _get(auth_client, f"/documents/{doc_id}/preview", xlsx)

    assert r.status_code == 409


async def test_stored_macro_file_is_refused(auth_client, db):
    docx = make_docx("macro doc")
    doc_id = await _ready(auth_client, db, docx, "spec.docx")

    r, _ = await _get(auth_client, f"/documents/{doc_id}/preview", with_macros(docx))

    assert r.status_code == 409


async def test_processing_document_409(auth_client):
    pdf = make_pdf(["one"])
    doc_id = await _upload(auth_client, pdf, "plan.pdf")

    r, dl = await _get(auth_client, f"/documents/{doc_id}/preview", pdf)

    assert r.status_code == 409
    dl.assert_not_called()


async def test_non_member_gets_404(auth_client, admin_client, db, make_project):
    outsider = await make_project(member=None)
    pdf = make_pdf(["secret"])
    doc_id = await _ready(admin_client, db, pdf, "plan.pdf", project_id=outsider)

    for url in (
        f"/documents/{doc_id}/preview",
        f"/documents/{doc_id}/preview/pages/1",
    ):
        r, dl = await _get(auth_client, url, pdf)
        assert r.status_code == 404
        dl.assert_not_called()


async def test_preview_requires_auth(client):
    doc_id = uuid.uuid4()
    assert (await client.get(f"/documents/{doc_id}/preview")).status_code == 401
    r = await client.get(f"/documents/{doc_id}/preview/pages/1")
    assert r.status_code == 401
