"""app/services/previews.py: turning files into what the browser shows."""

import datetime as dt
import io

import pytest
from docx import Document
from openpyxl import Workbook

from app.services import previews
from tests.helpers.files import make_pdf, make_xlsx

# ── PDF ──


def test_pdf_page_sizes():
    pdf = make_pdf(["one", "two"], size=(842, 595))
    assert previews.pdf_page_sizes(pdf) == [
        {"width": 842, "height": 595},
        {"width": 842, "height": 595},
    ]


def test_render_pdf_page_is_a_png_of_the_asked_width():
    png = previews.render_pdf_page(make_pdf(["one"]), 1, 600)
    assert png.startswith(b"\x89PNG")
    width = int.from_bytes(png[16:20], "big")
    assert width == 600


def test_render_pdf_page_clamps_width_and_pixels():
    tall = make_pdf(["long sheet"], size=(600, 14400))
    png = previews.render_pdf_page(tall, 1, 99999)
    width = int.from_bytes(png[16:20], "big")
    height = int.from_bytes(png[20:24], "big")
    assert width <= previews.MAX_PAGE_WIDTH
    assert width * height <= previews.MAX_PAGE_PIXELS * 1.01


def test_render_missing_pdf_page():
    with pytest.raises(IndexError):
        previews.render_pdf_page(make_pdf(["one"]), 2, 600)


# ── Word ──


def _docx(build) -> bytes:
    doc = Document()
    build(doc)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_docx_html_keeps_headings_lists_and_tables():
    def build(doc):
        doc.add_heading("Loft spec", level=1)
        doc.add_paragraph("Beams per drawings.")
        doc.add_paragraph("Insulation", style="List Bullet")
        table = doc.add_table(rows=1, cols=2)
        table.rows[0].cells[0].text = "Bedroom"
        table.rows[0].cells[1].text = "4.2m"

    html = previews.docx_html(_docx(build))
    assert "<h1>Loft spec</h1>" in html
    assert "<p>Beams per drawings.</p>" in html
    assert "<li>Insulation</li>" in html
    assert "<td><p>Bedroom</p></td>" in html


def test_docx_html_removes_unsafe_markup():
    raw = (
        '<a href="javascript:alert(1)">bad</a>'
        '<a href="https://example.com" onclick="x()">ok</a>'
        '<img src="data:image/svg+xml;base64,AA"><img src="https://tracker/x.png">'
        '<img src="data:image/png;base64,AA">'
        "<script>alert(1)</script><iframe></iframe><p style='color:red'>t</p>"
    )
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            previews.mammoth,
            "convert_to_html",
            lambda _f: type("R", (), {"value": raw})(),
        )
        html = previews.docx_html(b"ignored")

    assert "javascript" not in html
    assert "onclick" not in html
    assert "svg" not in html
    assert "tracker" not in html
    assert "<script" not in html and "<iframe" not in html
    assert "style" not in html
    assert '<img src="data:image/png;base64,AA">' in html
    assert (
        '<a href="https://example.com" target="_blank" rel="noopener noreferrer">ok</a>'
        in html
    )


def test_docx_html_too_large(monkeypatch):
    monkeypatch.setattr(previews, "MAX_HTML_BYTES", 10)
    with pytest.raises(previews.PreviewTooLarge):
        previews.docx_html(_docx(lambda d: d.add_paragraph("x" * 100)))


# ── Excel ──


def test_xlsx_sheets_skip_hidden_and_trim_empty_edges():
    wb = Workbook()
    ws = wb.active
    ws.title = "Quote"
    ws.append(["Item", "Cost"])
    ws.append(["Beam", 1200])
    ws["B2"].number_format = '"£"#,##0.00'
    ws["D10"].number_format = "0.00"  # formatted but empty: not shown
    wb.create_sheet("Workings").sheet_state = "hidden"
    wb.create_sheet("Labour").append(["Days", 14])
    buf = io.BytesIO()
    wb.save(buf)

    sheets = previews.xlsx_sheets(buf.getvalue())

    assert [s["name"] for s in sheets] == ["Quote", "Labour"]
    assert sheets[0]["rows"] == [
        [{"text": "Item", "numeric": False}, {"text": "Cost", "numeric": False}],
        [{"text": "Beam", "numeric": False}, {"text": "£1,200.00", "numeric": True}],
    ]
    assert sheets[0]["cut_rows"] is False
    assert sheets[0]["cut_columns"] is False


def test_xlsx_sheets_cut_big_sheets(monkeypatch):
    monkeypatch.setattr(previews, "MAX_ROWS", 3)
    monkeypatch.setattr(previews, "MAX_COLUMNS", 2)
    sheet = previews.xlsx_sheets(make_xlsx([[1, 2, 3]] * 5))[0]
    assert len(sheet["rows"]) == 3
    assert len(sheet["rows"][0]) == 2
    assert sheet["cut_rows"] is True
    assert sheet["cut_columns"] is True


def test_xlsx_empty_sheet():
    sheet = previews.xlsx_sheets(make_xlsx([]))[0]
    assert sheet["rows"] == []


@pytest.mark.parametrize(
    ("value", "fmt", "text"),
    [
        (1234.5, '"£"#,##0.00', "£1,234.50"),
        (-50, "[$£-809]#,##0.00", "-£50.00"),
        (0.125, "0.0%", "12.5%"),
        (3, "General", "3"),
        (1 / 3, "General", "0.3333333333"),
        (1500, "#,##0", "1,500"),
        (True, "General", "TRUE"),
        (dt.datetime(2026, 11, 19), "dd/mm/yyyy", "19/11/2026"),
        (dt.datetime(2026, 11, 19, 14, 30), "dd/mm/yyyy hh:mm", "19/11/2026 14:30"),
        ("#DIV/0!", "General", "#DIV/0!"),
    ],
)
def test_format_value(value, fmt, text):
    assert previews.format_value(value, fmt) == text
