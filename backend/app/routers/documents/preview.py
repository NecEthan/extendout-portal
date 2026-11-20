"""Preview a document's ACTIVE version in the app: PDF pages as images, Word
as cleaned HTML, Excel as rows. The file is parsed here, not in the browser."""

import asyncio
import uuid
from collections.abc import Callable

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.base import User
from app.schemas.documents import DocumentPreviewResponse
from app.services import previews
from app.services.document_files import load_active_file
from app.services.documents import _DOCX, _PDF, _XLSX

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["documents"])

# Parsing an uploaded file can be slow (huge sheets, complex drawings); give up
# rather than hold a worker thread. The thread itself finishes in the background.
PREVIEW_TIMEOUT_SECONDS = 30

CANT_PREVIEW = "This file can't be previewed. Download it to open it instead."


async def _run[T](fn: Callable[..., T], *args) -> T:
    """Run a parser in a thread with a time limit; 409 if it fails."""
    loop = asyncio.get_running_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(None, fn, *args), timeout=PREVIEW_TIMEOUT_SECONDS
        )
    except (TimeoutError, previews.PreviewTooLarge) as exc:
        logger.warning("document_preview_too_large", error=type(exc).__name__)
        raise HTTPException(status_code=409, detail=CANT_PREVIEW) from exc
    except IndexError:
        raise
    except Exception as exc:
        logger.warning("document_preview_failed", error=type(exc).__name__)
        raise HTTPException(status_code=409, detail=CANT_PREVIEW) from exc


@router.get("/{document_id}/preview", response_model=DocumentPreviewResponse)
async def preview_document(
    document_id: uuid.UUID,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentPreviewResponse:
    """Same access rules as download (``load_active_file``). Recorded in the
    audit log as an open of the document."""
    file = await load_active_file(db, current_user, document_id, request)
    response.headers["Cache-Control"] = "private, no-store"

    if file.content_type == _PDF:
        pages = await _run(previews.pdf_page_sizes, file.content)
        return DocumentPreviewResponse(kind="pdf", pages=pages)
    if file.content_type == _DOCX:
        html = await _run(previews.docx_html, file.content)
        return DocumentPreviewResponse(kind="docx", html=html)
    if file.content_type == _XLSX:
        sheets = await _run(previews.xlsx_sheets, file.content)
        return DocumentPreviewResponse(kind="xlsx", sheets=sheets)
    raise HTTPException(status_code=409, detail=CANT_PREVIEW)


@router.get("/{document_id}/preview/pages/{page_number}")
async def preview_pdf_page(
    document_id: uuid.UUID,
    page_number: int,
    request: Request,
    width: int = Query(800, ge=previews.MIN_PAGE_WIDTH, le=previews.MAX_PAGE_WIDTH),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """One page of a PDF as a PNG ``width`` pixels wide. 404 for a page that
    doesn't exist, 409 if the document isn't a PDF."""
    file = await load_active_file(db, current_user, document_id, request)
    if file.content_type != _PDF:
        raise HTTPException(status_code=409, detail=CANT_PREVIEW)
    try:
        png = await _run(previews.render_pdf_page, file.content, page_number, width)
    except IndexError as exc:
        raise HTTPException(status_code=404, detail="Page not found") from exc

    return Response(
        content=png,
        media_type="image/png",
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cache-Control": "private, no-store",
        },
    )
