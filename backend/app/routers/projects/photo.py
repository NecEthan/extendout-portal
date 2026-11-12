"""DELETE /projects/{project_id}/photos/{photo_id} — delete a site photo
(`apiRoutes.projects.photo`). Admins: any photo; others: only their own (see
can_delete_photo)."""

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
from app.services.permissions import can_delete_photo, ensure_project_access

router = APIRouter(tags=["photos"])
logger = structlog.get_logger(__name__)


@router.delete("/{project_id}/photos/{photo_id}", status_code=204)
async def delete_photo(
    project_id: int,
    photo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    await ensure_project_access(db, current_user, project_id)
    photo = await db.get(ProjectPhoto, photo_id)
    if photo is None or photo.project_id != project_id:
        raise HTTPException(status_code=404, detail="Photo not found")
    if not can_delete_photo(current_user, photo):
        raise HTTPException(
            status_code=403, detail="You can only delete photos you uploaded"
        )

    storage_key = photo.storage_key
    await db.delete(photo)
    await db.commit()

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, storage.delete_object, storage_key)
    except Exception:
        logger.warning(
            "photo_file_delete_failed", photo_id=str(photo_id), exc_info=True
        )

    logger.info(
        "photo_deleted",
        photo_id=str(photo_id),
        project_id=project_id,
        deleted_by=str(current_user.id),
    )
    return Response(status_code=204)
