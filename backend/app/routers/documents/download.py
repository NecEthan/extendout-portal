"""Download a document's original file (its ACTIVE version)."""

import asyncio
import re
import uuid
from urllib.parse import quote

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.base import Document, DocumentVersion, User
from app.services import storage
from app.services.documents import (
    ALLOWED_CONTENT_TYPES,
    FILE_EXTENSIONS,
    STORAGE_UNAVAILABLE_DETAIL,
    detect_content_type,
)
from app.services.permissions import document_access_filters

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["documents"])


def _content_disposition(title: str, extension: str) -> str:
    """``attachment`` header naming the file after the document title.

    The plain ``filename`` is an ASCII fallback with anything that could break
    the header (quotes, backslashes, control characters, path separators)
    replaced; ``filename*`` carries the full UTF-8 name, percent-encoded.
    """
    name = title.strip() or "document"
    if not name.lower().endswith(extension):
        name += extension
    ascii_name = re.sub(r'[^\x20-\x7e]|["\\/]', "_", name)
    encoded = quote(name, safe="")
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded}"


@router.get("/{document_id}/download")
async def download_document(
    document_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """The original file of the document's ACTIVE version, as an attachment.

    Same access rules as reading the document (404 outside the user's
    projects). Only ACTIVE versions are served: processing, failed and deleted
    ones never are. The type is re-checked from the bytes, so a file stored
    before an upload rule existed (e.g. the macro check) is refused too.
    """
    result = await db.execute(
        select(Document)
        .where(Document.id == document_id)
        .where(*document_access_filters(current_user))
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    version = (
        await db.execute(
            select(DocumentVersion)
            .where(DocumentVersion.document_id == document_id)
            .where(DocumentVersion.status == "ACTIVE")
        )
    ).scalar_one_or_none()
    if version is None:
        raise HTTPException(
            status_code=409, detail="This document has no version ready to download"
        )
    request.state.audit_project_id = doc.project_id
    request.state.audit_details = {
        "title": doc.title,
        "version_number": version.version_number,
    }

    loop = asyncio.get_running_loop()
    try:
        content = await loop.run_in_executor(
            None, storage.download_bytes, version.storage_key
        )
    except Exception as exc:
        logger.exception("document_download_failed", version_id=str(version.id))
        raise HTTPException(status_code=503, detail=STORAGE_UNAVAILABLE_DETAIL) from exc

    content_type = detect_content_type(content)
    if content_type not in ALLOWED_CONTENT_TYPES:
        logger.warning("document_download_refused", version_id=str(version.id))
        raise HTTPException(status_code=409, detail="This file can't be downloaded")

    return Response(
        content=content,
        media_type=content_type,
        headers={
            # Always save to disk; never open the file inside the app's origin.
            "Content-Disposition": _content_disposition(
                doc.title, FILE_EXTENSIONS[content_type]
            ),
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            # Documents can be replaced or deleted, and access can be revoked.
            "Cache-Control": "private, no-store",
        },
    )
