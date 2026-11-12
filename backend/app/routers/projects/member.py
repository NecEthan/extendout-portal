"""DELETE /projects/{project_id}/members/{user_id} — remove someone from a project
(admin only) (`apiRoutes.projects.member`)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_admin
from app.models.base import ProjectMember, User

router = APIRouter(tags=["project members"])


@router.delete("/{project_id}/members/{user_id}", status_code=204)
async def remove_project_member(
    project_id: int,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> Response:
    member = await db.get(ProjectMember, (project_id, user_id))
    if member is None:
        raise HTTPException(status_code=404, detail="Not a member of this project")
    await db.delete(member)
    await db.commit()
    return Response(status_code=204)
