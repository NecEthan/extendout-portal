"""Project members router — who can access a project.

Mounted under /projects, all admin only:
  GET    /projects/{project_id}/members
  POST   /projects/{project_id}/members
  DELETE /projects/{project_id}/members/{user_id}
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_admin
from app.models.base import ProjectMember, User
from app.schemas.team import AddMemberRequest, MemberResponse
from app.services.permissions import ensure_project_access

router = APIRouter(tags=["project members"])


@router.get("/{project_id}/members", response_model=list[MemberResponse])
async def list_project_members(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> list[MemberResponse]:
    await ensure_project_access(db, admin, project_id)  # 404 if unknown project
    result = await db.execute(
        select(User)
        .join(ProjectMember, ProjectMember.user_id == User.id)
        .where(ProjectMember.project_id == project_id)
        .order_by(User.name.nulls_last(), User.email)
    )
    return [MemberResponse.model_validate(u) for u in result.scalars().all()]


@router.post("/{project_id}/members", status_code=201, response_model=MemberResponse)
async def add_project_member(
    project_id: int,
    body: AddMemberRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> MemberResponse:
    await ensure_project_access(db, admin, project_id)  # 404 if unknown project
    user = await db.get(User, body.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    existing = await db.get(ProjectMember, (project_id, user.id))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Already a member of this project")
    db.add(ProjectMember(project_id=project_id, user_id=user.id))
    await db.commit()
    return MemberResponse.model_validate(user)


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
