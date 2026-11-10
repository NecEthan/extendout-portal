"""Site photos for a project: upload (with an optional description), list,
and serve the image. Anyone with access to the project can do all three.

Images are stored in MinIO under ``photos/<uuid>``; the bucket is private, so
the browser loads each image through ``GET .../photos/{id}/file``, which checks
project access first.
"""

import asyncio
import uuid

import structlog
from fastapi import (
    APIRouter,
    Depends,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.limiter import upload_limit
from app.models.base import ProjectPhoto, User
from app.schemas.photos import MAX_DESCRIPTION_LENGTH, PhotoResponse
from app.services import storage
from app.services.documents import STORAGE_UNAVAILABLE_DETAIL
from app.services.permissions import ensure_project_access
from app.services.photos import generate_photo_storage_key, read_and_validate_photo

router = APIRouter(tags=["photos"])
logger = structlog.get_logger(__name__)


def _uploader_name(user: User | None) -> str | None:
    if user is None:
        return None
    return user.name or user.email


def _to_response(photo: ProjectPhoto, uploader: User | None) -> PhotoResponse:
    return PhotoResponse(
        id=photo.id,
        project_id=photo.project_id,
        description=photo.description,
        content_type=photo.content_type,
        uploaded_by_name=_uploader_name(uploader),
        created_at=photo.created_at,
    )


@router.get("/{project_id}/photos", response_model=list[PhotoResponse])
async def list_photos(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PhotoResponse]:
    await ensure_project_access(db, current_user, project_id)
    result = await db.execute(
        select(ProjectPhoto, User)
        .outerjoin(User, User.id == ProjectPhoto.uploaded_by)
        .where(ProjectPhoto.project_id == project_id)
        .order_by(ProjectPhoto.created_at.desc())
    )
    return [_to_response(photo, uploader) for photo, uploader in result.all()]


@router.post(
    "/{project_id}/photos", status_code=201, response_model=PhotoResponse
)
@upload_limit
async def upload_photo(
    request: Request,  # required by @upload_limit (slowapi), even though unused here
    project_id: int,
    file: UploadFile,
    description: str | None = Form(None, max_length=MAX_DESCRIPTION_LENGTH),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PhotoResponse:
    await ensure_project_access(db, current_user, project_id)
    content, content_type = await read_and_validate_photo(file)
    description = (description or "").strip() or None

    storage_key = generate_photo_storage_key()
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(
            None, storage.upload_bytes, storage_key, content, content_type
        )
    except Exception as exc:
        logger.exception("photo_storage_upload_failed", storage_key=storage_key)
        raise HTTPException(
            status_code=503, detail=STORAGE_UNAVAILABLE_DETAIL
        ) from exc

    photo = ProjectPhoto(
        project_id=project_id,
        storage_key=storage_key,
        content_type=content_type,
        description=description,
        uploaded_by=current_user.id,
    )
    try:
        db.add(photo)
        await db.commit()
        await db.refresh(photo)
    except Exception:
        await db.rollback()
        await loop.run_in_executor(None, storage.delete_object, storage_key)
        raise

    logger.info("photo_uploaded", photo_id=str(photo.id), project_id=project_id)
    return _to_response(photo, current_user)


@router.get("/{project_id}/photos/{photo_id}/file")
async def get_photo_file(
    project_id: int,
    photo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    await ensure_project_access(db, current_user, project_id)
    photo = await db.get(ProjectPhoto, photo_id)
    if photo is None or photo.project_id != project_id:
        raise HTTPException(status_code=404, detail="Photo not found")

    loop = asyncio.get_running_loop()
    try:
        content = await loop.run_in_executor(
            None, storage.download_bytes, photo.storage_key
        )
    except Exception as exc:
        logger.exception("photo_storage_download_failed", photo_id=str(photo_id))
        raise HTTPException(
            status_code=503, detail=STORAGE_UNAVAILABLE_DETAIL
        ) from exc

    # A photo's bytes never change (new upload = new id), so the browser can
    # cache it. "private": only the user's browser, never a shared cache.
    return Response(
        content=content,
        media_type=photo.content_type,
        headers={"Cache-Control": "private, max-age=86400"},
    )
