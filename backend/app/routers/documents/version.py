"""GET /documents/{document_id}/versions/{version_id} — one version
(`apiRoutes.documents.version`)."""

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.base import Document, DocumentVersion, User
from app.schemas.documents import (
    DocumentVersionResponse,
)
from app.services.permissions import document_access_filters

router = APIRouter(tags=["documents"])
logger = structlog.get_logger(__name__)


@router.get(
    "/{document_id}/versions/{version_id}",
    response_model=DocumentVersionResponse,
)
async def get_document_version(
    document_id: uuid.UUID,
    version_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentVersionResponse:
    result = await db.execute(
        select(Document)
        .where(Document.id == document_id)
        .where(*document_access_filters(current_user))
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Document not found")

    result = await db.execute(
        select(DocumentVersion)
        .where(DocumentVersion.id == version_id)
        .where(DocumentVersion.document_id == document_id)
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")

    return DocumentVersionResponse.model_validate(version)
