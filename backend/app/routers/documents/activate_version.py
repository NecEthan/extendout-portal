"""PATCH /documents/{document_id}/versions/{version_id}/activate — make an older
version current again (`apiRoutes.documents.activateVersion`)."""

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
from app.services.activation import activate_version
from app.services.permissions import document_access_filters

router = APIRouter(tags=["documents"])
logger = structlog.get_logger(__name__)


_ACTIVATABLE_STATUSES = {"ACTIVE", "SUPERSEDED"}


@router.patch(
    "/{document_id}/versions/{version_id}/activate",
    response_model=DocumentVersionResponse,
)
async def activate_document_version(
    document_id: uuid.UUID,
    version_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentVersionResponse:
    doc_result = await db.execute(
        select(Document)
        .where(Document.id == document_id)
        .where(*document_access_filters(current_user))
    )
    doc = doc_result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    ver_result = await db.execute(
        select(DocumentVersion)
        .where(DocumentVersion.id == version_id)
        .where(DocumentVersion.document_id == document_id)
    )
    version = ver_result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")

    if version.status not in _ACTIVATABLE_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot activate a version with status {version.status}",
        )

    if version.status == "ACTIVE":
        return DocumentVersionResponse.model_validate(version)

    await activate_version(db, version_id, document_id)

    await db.commit()

    ver_result = await db.execute(
        select(DocumentVersion)
        .where(DocumentVersion.id == version_id)
        .where(DocumentVersion.document_id == document_id)
    )
    version = ver_result.scalar_one()
    return DocumentVersionResponse.model_validate(version)
