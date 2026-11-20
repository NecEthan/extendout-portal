"""Download a document's original file (its ACTIVE version)."""

import re
import uuid
from urllib.parse import quote

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.base import User
from app.services.document_files import load_active_file
from app.services.documents import FILE_EXTENSIONS

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
    Access, status and type checks are in ``load_active_file``."""
    file = await load_active_file(db, current_user, document_id, request)

    return Response(
        content=file.content,
        media_type=file.content_type,
        headers={
            # Always save to disk; never open the file inside the app's origin.
            "Content-Disposition": _content_disposition(
                file.document.title, FILE_EXTENSIONS[file.content_type]
            ),
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            # Documents can be replaced or deleted, and access can be revoked.
            "Cache-Control": "private, no-store",
        },
    )
