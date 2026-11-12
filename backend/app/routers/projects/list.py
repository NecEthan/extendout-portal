"""GET/POST /projects — projects the user may access; create one (admin)
(`apiRoutes.projects.list`).
"""

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_admin
from app.models.base import (
    Project,
    User,
)
from app.schemas.projects import (
    ProjectCreateRequest,
    ProjectResponse,
)
from app.services.permissions import (
    is_admin,
    member_project_ids,
)

logger = structlog.get_logger()
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
