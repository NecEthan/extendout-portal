"""Turn PDF, Word and Excel files into something a browser shows directly:
PDF pages as PNG images, Word as cleaned HTML, Excel as rows of text.

The browser gets no file parser, only the result. All of these parse an
untrusted uploaded file, so callers run them in a thread with a time limit
(``app/routers/documents/preview.py``).
"""

import datetime as dt
import io
import re
from typing import Any

import mammoth
import nh3
import pymupdf as fitz
from openpyxl import load_workbook

# Excel: big sheets would be slow to send and to draw; the rest is in the download.
MAX_ROWS = 1000
MAX_COLUMNS = 50

# PDF page images: widths the browser may ask for, and a pixel cap so a huge
# drawing sheet can't use lots of memory.
MIN_PAGE_WIDTH = 200
MAX_PAGE_WIDTH = 2400
MAX_PAGE_PIXELS = 16_000_000

# Word: images are inlined into the HTML; past this, download instead.
MAX_HTML_BYTES = 20_000_000


class PreviewTooLarge(ValueError):
    """The file is too big to preview; the user should download it."""


# ── PDF ────────────────────────────────────────────────────────────────────


def pdf_page_sizes(content: bytes) -> list[dict[str, float]]:
    """Each page's width and height in points (rotation applied)."""
    with fitz.open(stream=content, filetype="pdf") as doc:
        return [
            {"width": round(page.rect.width, 2), "height": round(page.rect.height, 2)}
            for page in doc
        ]


def render_pdf_page(content: bytes, page_number: int, width: int) -> bytes:
    """Page ``page_number`` (1-based) as a PNG ``width`` pixels wide.

    Raises IndexError for a page that doesn't exist.
    """
    width = max(MIN_PAGE_WIDTH, min(width, MAX_PAGE_WIDTH))
    with fitz.open(stream=content, filetype="pdf") as doc:
        if not 1 <= page_number <= len(doc):
            raise IndexError(page_number)
        page = doc[page_number - 1]
        rect = page.rect
        scale = width / rect.width
        # Very tall pages: shrink to stay under the pixel cap.
        scale = min(scale, (MAX_PAGE_PIXELS / (rect.width * rect.height)) ** 0.5)
        pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        return pixmap.tobytes("png")


# ── Word ───────────────────────────────────────────────────────────────────

_ALLOWED_TAGS = {
    "p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "u", "s",
    "sub", "sup", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td",
    "a", "img", "blockquote", "pre", "code",
}  # fmt: skip
_ALLOWED_ATTRIBUTES = {
    "a": {"href", "id"},
    "img": {"src", "alt"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan"},
    "li": {"id"},
    "p": {"id"},
}
_SAFE_HREF = re.compile(r"^(https?:|mailto:|tel:|#)", re.IGNORECASE)
_SAFE_IMAGE = re.compile(r"^data:image/(png|jpe?g|gif|bmp|webp);base64,", re.IGNORECASE)


def _keep_attribute(element: str, attribute: str, value: str) -> str | None:
    """Links only to web, email, phone or within the document; images only
    the file's own pictures (no SVG, no outside URLs that would track who
    opened it)."""
    if element == "a" and attribute == "href":
        return value if _SAFE_HREF.match(value.strip()) else None
    if element == "img" and attribute == "src":
        return value if _SAFE_IMAGE.match(value) else None
    return value


def docx_html(content: bytes) -> str:
    """The document as HTML (headings, lists, tables, images), cleaned so
    only the tags above survive: no scripts, styles, iframes or event
    handlers. Text flows to the screen width; Word's page layout is not kept.
    """
    html = mammoth.convert_to_html(io.BytesIO(content)).value
    if len(html) > MAX_HTML_BYTES:
        raise PreviewTooLarge("Word document too large to preview")
    return nh3.clean(
        html,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRIBUTES,
        url_schemes={"http", "https", "mailto", "tel", "data"},
        attribute_filter=_keep_attribute,
        link_rel="noopener noreferrer",
        set_tag_attribute_values={"a": {"target": "_blank"}},
    )


# ── Excel ──────────────────────────────────────────────────────────────────


def xlsx_sheets(content: bytes) -> list[dict[str, Any]]:
    """Each visible sheet's first ``MAX_ROWS`` × ``MAX_COLUMNS`` cells as text.

    Formulas give the result Excel last saved (blank if never saved by Excel).
    Trailing empty rows and columns are dropped.
    """
    workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    try:
        return [_sheet(ws) for ws in workbook.worksheets if ws.sheet_state == "visible"]
    finally:
        workbook.close()


def _sheet(ws) -> dict[str, Any]:
    rows: list[list[dict[str, Any]]] = []
    cut_rows = cut_columns = False
    for r, row in enumerate(
        ws.iter_rows(max_row=MAX_ROWS + 1, max_col=MAX_COLUMNS + 1)
    ):
        if r == MAX_ROWS:
            cut_rows = any(c.value is not None for c in row)
            break
        if len(row) > MAX_COLUMNS and row[MAX_COLUMNS].value is not None:
            cut_columns = True
        rows.append([_cell(c) for c in row[:MAX_COLUMNS]])

    # Drop empty rows/columns at the end (formatting often stretches the range).
    while rows and not any(c["text"] for c in rows[-1]):
        rows.pop()
    width = max(
        (
            max((i + 1 for i, c in enumerate(row) if c["text"]), default=0)
            for row in rows
        ),
        default=0,
    )
    rows = [(row + [_EMPTY] * width)[:width] for row in rows]
    return {
        "name": ws.title,
        "rows": rows,
        "cut_rows": cut_rows,
        "cut_columns": cut_columns,
    }


_EMPTY = {"text": "", "numeric": False}


def _cell(cell) -> dict[str, Any]:
    value = getattr(cell, "value", None)
    if value is None:
        return _EMPTY
    numeric = isinstance(value, (int, float)) and not isinstance(value, bool)
    return {
        "text": format_value(value, getattr(cell, "number_format", None)),
        "numeric": numeric,
    }


# Excel writes currencies as [$£-809] (symbol + locale) or as "£" / £.
_LOCALE_CURRENCY = re.compile(r"\[\$([^\-\]]*)")
_CURRENCY = re.compile(r"[£$€]")


def format_value(value: Any, number_format: str | None) -> str:
    """A cell value roughly as Excel shows it: currency symbol, thousands
    separators, decimal places, percentages and UK-style dates. Not a full
    Excel number-format engine; unusual formats fall back to plain numbers."""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, dt.datetime):
        if value.time() == dt.time(0):
            return value.strftime("%d/%m/%Y")
        return value.strftime("%d/%m/%Y %H:%M")
    if isinstance(value, dt.date):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, dt.time):
        return value.strftime("%H:%M")
    if not isinstance(value, (int, float)):
        return str(value)

    fmt = (number_format or "General").split(";")[0]
    if fmt == "General" or not re.search(r"[0#]", fmt):
        return f"{value:.10g}" if isinstance(value, float) else str(value)
    percent = "%" in fmt
    if percent:
        value *= 100
    decimals_match = re.search(r"\.([0#]+)", fmt)
    decimals = len(decimals_match.group(1)) if decimals_match else 0
    separator = "," if "," in fmt else ""
    text = f"{abs(value):{separator}.{decimals}f}"
    text = _currency(fmt) + text
    if percent:
        text += "%"
    return f"-{text}" if value < 0 else text


def _currency(fmt: str) -> str:
    locale = _LOCALE_CURRENCY.search(fmt)
    if locale:
        return locale.group(1)
    plain = _CURRENCY.search(fmt)
    return plain.group(0) if plain else ""
