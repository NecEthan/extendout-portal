"""Load the file of a document's ACTIVE version, for download and preview."""

import asyncio
import uuid
from dataclasses import dataclass

import structlog
from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Document, DocumentVersion, User
from app.services import storage
from app.services.documents import (
    ALLOWED_CONTENT_TYPES,
    STORAGE_UNAVAILABLE_DETAIL,
    detect_content_type,
)
from app.services.permissions import document_access_filters

logger = structlog.get_logger(__name__)


@dataclass
class ActiveFile:
    document: Document
    version: DocumentVersion
    content: bytes
    content_type: str


async def load_active_file(
    db: AsyncSession, user: User, document_id: uuid.UUID, request: Request
) -> ActiveFile:
    """The ACTIVE version's bytes and their detected type.

    Same access rules as reading the document (404 outside the user's
    projects). Only ACTIVE versions are served (409 otherwise): processing,
    failed and deleted ones never are. The type is re-checked from the bytes,
    so a file stored before an upload rule existed (e.g. the macro check) is
    refused too (409). 503 if storage is down. Sets the audit context.
    """
    doc = (
        await db.execute(
            select(Document)
            .where(Document.id == document_id)
            .where(*document_access_filters(user))
        )
    ).scalar_one_or_none()
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
            status_code=409, detail="This document has no version ready to open"
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
        logger.exception("document_file_load_failed", version_id=str(version.id))
        raise HTTPException(status_code=503, detail=STORAGE_UNAVAILABLE_DETAIL) from exc

    content_type = detect_content_type(content)
    if content_type not in ALLOWED_CONTENT_TYPES:
        logger.warning("document_file_refused", version_id=str(version.id))
        raise HTTPException(status_code=409, detail="This file can't be opened")

    return ActiveFile(doc, version, content, content_type)
