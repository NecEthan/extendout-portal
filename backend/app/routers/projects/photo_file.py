"""GET /projects/{project_id}/photos/{photo_id}/file — stream the image from MinIO
after the project-access check (`apiRoutes.projects.photoFile`)."""

import asyncio
import uuid

import structlog
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Response,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.base import ProjectPhoto, User
from app.services import storage
from app.services.documents import STORAGE_UNAVAILABLE_DETAIL
from app.services.permissions import ensure_project_access

router = APIRouter(tags=["photos"])
logger = structlog.get_logger(__name__)


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
        raise HTTPException(status_code=503, detail=STORAGE_UNAVAILABLE_DETAIL) from exc

    # A photo's bytes never change (new upload = new id), so the browser can
    # cache it. "private": only the user's browser, never a shared cache.
    return Response(
        content=content,
        media_type=photo.content_type,
        headers={
            "Cache-Control": "private, max-age=86400",
            # Never treat the file as anything but its image type (e.g. a
            # disguised file holding HTML), and never let scripts run in it.
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )
