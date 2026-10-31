import asyncio

import structlog
from arq.connections import ArqRedis
from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_arq_pool, get_current_user, get_db, sensitivity_filters
from app.models.base import Document, User
from app.schemas.documents import (
    DocumentResponse,
    DocumentUploadedResponse,
    PaginatedDocumentsResponse,
)
from app.services import storage
from app.services.documents import (
    assert_no_duplicate,
    compute_hash,
    create_document_records,
    generate_storage_key,
    read_and_validate,
)
from app.utils.enqueue import enqueue_processing_job

router = APIRouter(tags=["documents"])
logger = structlog.get_logger(__name__)

_VALID_SENSITIVITIES = {"STANDARD", "SENSITIVE"}


async def _check_sensitivity_permission(
    sensitivity: str, current_user: User
) -> None:
    if sensitivity not in _VALID_SENSITIVITIES:
        raise HTTPException(
            status_code=422,
            detail=f"sensitivity must be one of {sorted(_VALID_SENSITIVITIES)}",
        )
    if sensitivity == "SENSITIVE" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can upload sensitive documents")


@router.post("", status_code=202, response_model=DocumentUploadedResponse)
async def upload_document(
    file: UploadFile,
    title: str = Form(),
    sensitivity: str = Form(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    arq_pool: ArqRedis = Depends(get_arq_pool),
) -> DocumentUploadedResponse:
    logger.info("document_upload_start", filename=file.filename, sensitivity=sensitivity)

    await _check_sensitivity_permission(sensitivity, current_user)

    content, content_type = await read_and_validate(file)
    content_hash = compute_hash(content)
    await assert_no_duplicate(db, content_hash)

    storage_key = generate_storage_key()
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, storage.upload_bytes, storage_key, content, content_type)
    await loop.run_in_executor(None, storage.tag_as_orphan, storage_key)

    try:
        doc, version, job = await create_document_records(
            db, title, sensitivity, content_hash, storage_key, current_user
        )
    except Exception:
        await db.rollback()
        await loop.run_in_executor(None, storage.delete_object, storage_key)
        raise

    await loop.run_in_executor(None, storage.confirm_object, storage_key)
    await enqueue_processing_job(arq_pool, db, job, version.id)

    return DocumentUploadedResponse(id=doc.id, status="accepted")


@router.get("", response_model=PaginatedDocumentsResponse)
async def list_documents(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedDocumentsResponse:
    filters = sensitivity_filters(current_user)

    total = await db.scalar(select(func.count()).select_from(Document).where(*filters))

    result = await db.execute(
        select(Document)
        .where(*filters)
        .order_by(Document.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = [DocumentResponse.model_validate(d) for d in result.scalars().all()]
    return PaginatedDocumentsResponse(
        items=items, total=total or 0, limit=limit, offset=offset
    )
