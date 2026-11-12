"""GET/POST /documents — list documents, upload a new one
(`apiRoutes.documents.list`).
"""

import asyncio

import structlog
from arq.connections import ArqRedis
from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_arq_pool, get_current_user, get_db
from app.limiter import upload_limit
from app.models.base import Document, DocumentVersion, User
from app.schemas.documents import (
    DocumentResponse,
    DocumentUploadedResponse,
    PaginatedDocumentsResponse,
)
from app.services import storage
from app.services.documents import (
    DUPLICATE_CONTENT_DETAIL,
    STORAGE_UNAVAILABLE_DETAIL,
    assert_no_duplicate,
    compute_hash,
    create_document_records,
    generate_storage_key,
    is_duplicate_content_error,
    read_and_validate,
)
from app.services.permissions import document_access_filters, ensure_project_access
from app.utils.enqueue import enqueue_processing_job

router = APIRouter(tags=["documents"])
logger = structlog.get_logger(__name__)


@router.post("", status_code=202, response_model=DocumentUploadedResponse)
@upload_limit
async def upload_document(
    request: Request,
    file: UploadFile,
    title: str = Form(),
    project_id: int = Form(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    arq_pool: ArqRedis = Depends(get_arq_pool),
) -> DocumentUploadedResponse:
    request.state.audit_project_id = project_id
    logger.info(
        "document_upload_start",
        filename=file.filename,
        project_id=project_id,
    )

    await ensure_project_access(db, current_user, project_id)

    content, content_type = await read_and_validate(file)
    content_hash = compute_hash(content)
    await assert_no_duplicate(db, content_hash, project_id)

    storage_key = generate_storage_key()
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(
            None, storage.upload_bytes, storage_key, content, content_type
        )
    except Exception as exc:
        # MinIO down, unreachable or misconfigured. Nothing to clean up: no DB
        # records exist yet and the file wasn't stored.
        logger.exception("storage_upload_failed", storage_key=storage_key)
        raise HTTPException(status_code=503, detail=STORAGE_UNAVAILABLE_DETAIL) from exc

    try:
        doc, version, job = await create_document_records(
            db, title, content_hash, storage_key, current_user, project_id
        )
    except Exception as exc:
        await db.rollback()
        await loop.run_in_executor(None, storage.delete_object, storage_key)
        if is_duplicate_content_error(exc):
            # Another upload of the same file committed first.
            raise HTTPException(
                status_code=409, detail=DUPLICATE_CONTENT_DETAIL
            ) from exc
        raise

    await enqueue_processing_job(arq_pool, db, job, version.id)

    return DocumentUploadedResponse(id=doc.id, status="accepted")


@router.get("", response_model=PaginatedDocumentsResponse)
async def list_documents(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    project_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedDocumentsResponse:
    filters = document_access_filters(current_user)
    if project_id is not None:
        await ensure_project_access(db, current_user, project_id)
        filters.append(Document.project_id == project_id)

    total = await db.scalar(select(func.count()).select_from(Document).where(*filters))

    latest_status = (
        select(DocumentVersion.status)
        .where(DocumentVersion.document_id == Document.id)
        .order_by(DocumentVersion.version_number.desc())
        .limit(1)
        .correlate(Document)
        .scalar_subquery()
    )

    has_active = (
        select(DocumentVersion.id)
        .where(DocumentVersion.document_id == Document.id)
        .where(DocumentVersion.status == "ACTIVE")
        .correlate(Document)
        .exists()
    )

    result = await db.execute(
        select(
            Document,
            latest_status.label("latest_version_status"),
            has_active.label("has_active_version"),
        )
        .where(*filters)
        .order_by(Document.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = [
        DocumentResponse(
            id=doc.id,
            title=doc.title,
            owner_id=doc.owner_id,
            source_type=doc.source_type,
            project_id=doc.project_id,
            created_at=doc.created_at,
            latest_version_status=status,
            has_active_version=active,
        )
        for doc, status, active in result.all()
    ]
    return PaginatedDocumentsResponse(
        items=items, total=total or 0, limit=limit, offset=offset
    )
