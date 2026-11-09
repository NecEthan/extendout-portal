"""Build real Office files for upload tests (uploads only accept PDF/DOCX/XLSX)."""

import io
from functools import cache

DOCX_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
XLSX_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@cache
def make_docx(text: str) -> bytes:
    """A .docx with one paragraph per blank-line-separated block of ``text``.

    Cached so the same text always yields identical bytes (python-docx output
    embeds timestamps), which keeps the duplicate-content (409) checks meaningful.
    """
    from docx import Document

    doc = Document()
    for para in text.split("\n\n"):
        doc.add_paragraph(para)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def make_xlsx(rows: list[list[object]], title: str = "Sheet1") -> bytes:
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = title
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def docx_upload(name: str, text: str) -> dict:
    """``files=`` payload for an httpx multipart upload of a .docx."""
    return {"file": (name, make_docx(text), DOCX_CT)}
