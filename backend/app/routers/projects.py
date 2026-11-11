"""Projects router — the projects the current user may access.

Creating, editing and deleting projects is admin only. Membership endpoints
live in project_members.py.
"""

import asyncio

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_admin
from app.models.base import (
    Document,
    DocumentChunk,
    DocumentVersion,
    ProcessingJob,
    Project,
    ProjectPhoto,
    User,
)
from app.schemas.projects import (
    ProjectCreateRequest,
    ProjectResponse,
    ProjectUpdateRequest,
)
from app.services import storage
from app.services.permissions import (
    ensure_project_access,
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


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    body: ProjectUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ProjectResponse:
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    # Only fields that were sent are changed. Fields may be omitted, not nulled.
    changes = body.model_dump(exclude_unset=True)
    if None in changes.values():
        raise HTTPException(status_code=422, detail="Fields can't be null")
    for field, value in changes.items():
        setattr(project, field, value)
    await db.commit()
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Response:
    """Permanently delete a project with its documents (all versions, chunks
    and processing jobs), photos and memberships, then remove their files from
    storage. The audit log keeps its records (it has no foreign keys)."""
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    request.state.audit_details = {"name": project.name}

    doc_ids = select(Document.id).where(Document.project_id == project_id)
    version_filter = or_(
        DocumentVersion.document_id.in_(doc_ids),
        DocumentVersion.project_id == project_id,
    )
    version_ids = select(DocumentVersion.id).where(version_filter)

    # Collect file keys before the rows go.
    storage_keys = list(
        (await db.execute(select(DocumentVersion.storage_key).where(version_filter)))
        .scalars()
        .all()
    ) + list(
        (
            await db.execute(
                select(ProjectPhoto.storage_key).where(
                    ProjectPhoto.project_id == project_id
                )
            )
        )
        .scalars()
        .all()
    )

    # Children in FK-dependency order. Photos and memberships cascade from the
    # project row in the database.
    await db.execute(
        delete(DocumentChunk).where(DocumentChunk.document_version_id.in_(version_ids))
    )
    await db.execute(
        delete(ProcessingJob).where(ProcessingJob.document_version_id.in_(version_ids))
    )
    await db.execute(delete(DocumentVersion).where(version_filter))
    await db.execute(delete(Document).where(Document.project_id == project_id))
    await db.execute(delete(Project).where(Project.id == project_id))
    await db.commit()

    # Best effort: a file left behind is only wasted space, never exposed.
    loop = asyncio.get_running_loop()
    for key in storage_keys:
        try:
            await loop.run_in_executor(None, storage.delete_object, key)
        except Exception:
            logger.warning("project_file_delete_failed", storage_key=key, exc_info=True)

    logger.info("project_deleted", project_id=project_id, files=len(storage_keys))
    return Response(status_code=204)
