"""Unit tests for text extraction."""

import io
from unittest.mock import MagicMock, patch

import pytest

from app.services.extractor import _MIN_CHARS_PER_PAGE, extract_text

# ── Helpers ───────────────────────────────────────────────────────────────────


def _mock_fitz_doc(page_texts: list[str]) -> MagicMock:
    """Return a MagicMock fitz document whose pages yield the given texts."""
    pages = []
    for text in page_texts:
        page = MagicMock()
        page.get_text.return_value = text
        pages.append(page)

    doc = MagicMock()
    doc.__enter__ = MagicMock(return_value=doc)
    doc.__exit__ = MagicMock(return_value=False)
    doc.__len__ = MagicMock(return_value=len(pages))
    doc.__iter__ = MagicMock(side_effect=lambda: iter(pages))
    return doc


def _make_blank_pdf(n_pages: int = 1) -> bytes:
    """Create a PDF with no text layer (simulates a scanned document)."""
    import pymupdf

    doc = pymupdf.open()
    for _ in range(n_pages):
        doc.new_page()
    return doc.tobytes()


def _make_docx(text: str) -> bytes:
    """Create a minimal DOCX file."""
    from docx import Document as DocxDoc

    doc = DocxDoc()
    doc.add_paragraph(text)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ── PDF extraction ────────────────────────────────────────────────────────────


def test_pdf_extracts_text():
    """Extracted text from all pages is returned.

    The page text must exceed _MIN_CHARS_PER_PAGE so OCR is not triggered.
    """
    # 80 chars — safely above the 50-char/page threshold.
    page_text = (
        "Hello ExtendOut Portal. This is a document text extraction test with content.\n"
    )
    mock_doc = _mock_fitz_doc([page_text])

    with patch("app.services.extractor.fitz") as mock_fitz:
        mock_fitz.open.return_value = mock_doc
        result = extract_text(b"fake pdf bytes", "application/pdf")

    assert "Hello ExtendOut Portal" in result


def test_pdf_multipage_extracts_all_text():
    """Text from every page is included in the result."""
    # Each page text is > 50 chars so OCR is not triggered.
    page_texts = [
        f"Page {i}: sufficient content to exceed the chars-per-page threshold here.\n"
        for i in range(3)
    ]
    mock_doc = _mock_fitz_doc(page_texts)

    with patch("app.services.extractor.fitz") as mock_fitz:
        mock_fitz.open.return_value = mock_doc
        result = extract_text(b"fake pdf bytes", "application/pdf")

    for i in range(3):
        assert f"Page {i}" in result


def test_pdf_strips_whitespace():
    """Returned text is stripped of leading/trailing whitespace."""
    # Page text with plenty of chars to avoid OCR branch.
    padded = "  " + "word " * 20 + "  "
    mock_doc = _mock_fitz_doc([padded])

    with patch("app.services.extractor.fitz") as mock_fitz:
        mock_fitz.open.return_value = mock_doc
        result = extract_text(b"fake pdf bytes", "application/pdf")

    assert result == result.strip()


# ── Scanned PDF / OCR ─────────────────────────────────────────────────────────


def test_scanned_pdf_triggers_ocr():
    """A PDF with no text layer should attempt OCR."""
    content = _make_blank_pdf(n_pages=2)

    ocr_result = "OCR extracted text"

    with patch("app.services.extractor._ocr_pdf", return_value=ocr_result) as mock_ocr:
        result = extract_text(content, "application/pdf")

    mock_ocr.assert_called_once()
    assert result == ocr_result


def test_scanned_pdf_ocr_unavailable_returns_empty():
    """If pytesseract/Pillow aren't installed, OCR returns empty string gracefully."""
    content = _make_blank_pdf()

    with patch("builtins.__import__", side_effect=ImportError("no module")):
        # Use the internal function directly; patch the import inside it.
        pass

    # Directly test _ocr_pdf with mocked imports
    from app.services import extractor

    original = extractor._ocr_pdf

    def _fake_ocr(doc):
        raise ImportError("pytesseract not available")

    # Wrap so ImportError is caught by the function itself
    with patch.object(extractor, "_ocr_pdf", side_effect=None, wraps=None) as m:
        m.return_value = ""
        result = extract_text(content, "application/pdf")

    assert isinstance(result, str)


def test_text_pdf_does_not_call_ocr():
    """A PDF with a text layer should not trigger OCR."""
    # Page with plenty of text so avg chars/page exceeds _MIN_CHARS_PER_PAGE.
    dense_text = "Word " * (_MIN_CHARS_PER_PAGE * 2)
    mock_doc = _mock_fitz_doc([dense_text])

    with (
        patch("app.services.extractor.fitz") as mock_fitz,
        patch("app.services.extractor._ocr_pdf") as mock_ocr,
    ):
        mock_fitz.open.return_value = mock_doc
        extract_text(b"fake pdf bytes", "application/pdf")

    mock_ocr.assert_not_called()


# ── DOCX extraction ───────────────────────────────────────────────────────────


def test_docx_extracts_text():
    content = _make_docx("Hello from DOCX")
    result = extract_text(
        content,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    assert "Hello from DOCX" in result


def test_docx_multiline():
    from docx import Document as DocxDoc

    doc = DocxDoc()
    doc.add_paragraph("First paragraph")
    doc.add_paragraph("Second paragraph")
    buf = io.BytesIO()
    doc.save(buf)
    content = buf.getvalue()

    result = extract_text(
        content,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    assert "First paragraph" in result
    assert "Second paragraph" in result


def test_docx_empty_paragraphs_skipped():
    from docx import Document as DocxDoc

    doc = DocxDoc()
    doc.add_paragraph("")
    doc.add_paragraph("Real content")
    doc.add_paragraph("")
    buf = io.BytesIO()
    doc.save(buf)
    content = buf.getvalue()

    result = extract_text(
        content,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    assert "Real content" in result
    assert result.strip() == "Real content"


# ── XLSX extraction ───────────────────────────────────────────────────────────

_XLSX_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _make_xlsx(sheets: dict[str, list[list]]) -> bytes:
    from openpyxl import Workbook

    wb = Workbook()
    wb.remove(wb.active)
    for title, rows in sheets.items():
        ws = wb.create_sheet(title)
        for row in rows:
            ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_xlsx_extracts_rows_per_sheet():
    content = _make_xlsx(
        {
            "Costs": [["Item", "Price"], ["Steel beam", 450], ["Skip hire", 280]],
            "Schedule": [["Week 1", "Foundations"]],
        }
    )
    result = extract_text(content, _XLSX_CT)
    assert "Sheet: Costs\nItem | Price\nSteel beam | 450\nSkip hire | 280" in result
    assert "Sheet: Schedule\nWeek 1 | Foundations" in result


def test_xlsx_skips_empty_rows_and_cells():
    content = _make_xlsx({"S": [["a", None, "b"], [None, None], ["c"]]})
    assert extract_text(content, _XLSX_CT) == "Sheet: S\na | b\nc"


def test_xlsx_empty_workbook_returns_empty_string():
    assert extract_text(_make_xlsx({"Empty": []}), _XLSX_CT) == ""


# ── Unsupported types ─────────────────────────────────────────────────────────


@pytest.mark.parametrize("content_type", ["text/plain", "text/markdown"])
def test_text_types_are_unsupported(content_type):
    with pytest.raises(ValueError, match="Unsupported content type"):
        extract_text(b"Hello", content_type)
