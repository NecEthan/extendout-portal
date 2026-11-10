import asyncio
import uuid

import structlog
from arq.connections import ArqRedis
from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_arq_pool, get_current_user, get_db
from app.limiter import upload_limit
from app.models.base import Document, DocumentVersion, ProcessingJob, User
from app.schemas.documents import (
    DocumentVersionResponse,
    PaginatedDocumentVersionsResponse,
    VersionUploadedResponse,
)
from app.services import storage
from app.services.activation import activate_version
from app.services.documents import (
    DUPLICATE_CONTENT_DETAIL,
    STORAGE_UNAVAILABLE_DETAIL,
    assert_no_duplicate,
    compute_hash,
    generate_storage_key,
    is_duplicate_content_error,
    read_and_validate,
)
from app.services.permissions import document_access_filters
from app.utils.enqueue import enqueue_processing_job

router = APIRouter(tags=["documents"])
logger = structlog.get_logger(__name__)


@router.post(
    "/{document_id}/versions",
    status_code=202,
    response_model=VersionUploadedResponse,
)
@upload_limit
async def upload_document_version(
    request: Request,
    document_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    arq_pool: ArqRedis = Depends(get_arq_pool),
) -> VersionUploadedResponse:
    result = await db.execute(
        select(Document)
        .where(Document.id == document_id)
        .where(*document_access_filters(current_user))
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    content, content_type = await read_and_validate(file)
    content_hash = compute_hash(content)
    # Includes this document's own versions: re-uploading an old version is
    # rejected; "Set as active" restores it instead.
    await assert_no_duplicate(db, content_hash, document.project_id)
    storage_key = generate_storage_key()

    # upload file in separate thread to avoid blocking the asynchronous event loop
    # because it calls api to upload the file to miniO server
    # we allow other requests to be made while this uploads completes
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(
            None, storage.upload_bytes, storage_key, content, content_type
        )
    except Exception as exc:
        # MinIO down, unreachable or misconfigured. Nothing to clean up: no DB
        # records exist yet and the file wasn't stored.
        logger.exception("storage_upload_failed", storage_key=storage_key)
        raise HTTPException(
            status_code=503, detail=STORAGE_UNAVAILABLE_DETAIL
        ) from exc

    try:
        # get max number of existing versions for this document to determine the next version number
        ver_result = await db.execute(
            select(func.max(DocumentVersion.version_number)).where(
                DocumentVersion.document_id == document_id
            )
        )
        max_ver = ver_result.scalar_one_or_none() or 0

        version = DocumentVersion(
            document_id=document_id,
            version_number=max_ver + 1,
            status="PROCESSING",
            content_hash=content_hash,
            storage_key=storage_key,
            created_by=current_user.id,
            project_id=document.project_id,
        )
        db.add(version)
        await db.flush()

        job = ProcessingJob(document_version_id=version.id, status="QUEUED")
        db.add(job)

        await db.commit()
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

    return VersionUploadedResponse(
        id=version.id,
        document_id=document_id,
        version_number=version.version_number,
        status="accepted",
    )


@router.get(
    "/{document_id}/versions",
    response_model=PaginatedDocumentVersionsResponse,
)
async def list_document_versions(
    document_id: uuid.UUID,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedDocumentVersionsResponse:
    result = await db.execute(
        select(Document)
        .where(Document.id == document_id)
        .where(*document_access_filters(current_user))
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Document not found")

    total = await db.scalar(
        select(func.count())
        .select_from(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
    )

    result = await db.execute(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.version_number.desc())
        .limit(limit)
        .offset(offset)
    )
    items = [DocumentVersionResponse.model_validate(v) for v in result.scalars().all()]
    return PaginatedDocumentVersionsResponse(
        items=items, total=total or 0, limit=limit, offset=offset
    )


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
