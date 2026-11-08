"""Projects router — the projects the current user may access.

Creating projects is admin only. Membership endpoints live in project_members.py.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_admin
from app.models.base import Project, User
from app.schemas.projects import ProjectCreateRequest, ProjectResponse
from app.services.permissions import (
    ensure_project_access,
    is_admin,
    member_project_ids,
)

router = APIRouter(tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProjectResponse]:
    query = select(Project).order_by(Project.id)
    if not is_admin(current_user):
        query = query.where(Project.id.in_(member_project_ids(current_user)))
    result = await db.execute(query)
    return [ProjectResponse.model_validate(p) for p in result.scalars().all()]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectResponse:
    # 404 if the project doesn't exist, 403 if a non-admin isn't a member.
    await ensure_project_access(db, current_user, project_id)
    project = await db.get(Project, project_id)
    return ProjectResponse.model_validate(project)


@router.post("", status_code=201, response_model=ProjectResponse)
async def create_project(
    body: ProjectCreateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ProjectResponse:
    project = Project(name=body.name, client=body.client, address=body.address)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectResponse.model_validate(project)
