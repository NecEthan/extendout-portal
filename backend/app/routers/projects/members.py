"""GET/POST /projects/{project_id}/members — who can access a project; add someone
(admin only) (`apiRoutes.projects.members`)."""

from fastapi import APIRouter, Depends, HTTPException, Request
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
    request: Request,
    project_id: int,
    body: AddMemberRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> MemberResponse:
    request.state.audit_details = {"user_id": str(body.user_id)}
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
