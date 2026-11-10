"""Project-membership access control.

Rules:
  - admin: every project and every document.
  - builder / client: only projects listed for them in project_members, and
    only documents belonging to those projects.
  - photos: admins can delete any photo; builders / clients only the photos
    they uploaded themselves.
"""

from fastapi import HTTPException
from sqlalchemy import ColumnElement, Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Document, Project, ProjectMember, ProjectPhoto, User


def is_admin(user: User) -> bool:
    return user.role == "admin"


def can_delete_photo(user: User, photo: ProjectPhoto) -> bool:
    """Admins can delete any photo; everyone else only their own uploads.

    Assumes project access was already checked (ensure_project_access).
    A photo whose uploader's account was deleted (uploaded_by is NULL) can
    only be deleted by an admin.
    """
    return is_admin(user) or photo.uploaded_by == user.id


def member_project_ids(user: User) -> Select:
    """Subquery of project ids the user is a member of."""
    return select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)


def document_access_filters(user: User) -> list[ColumnElement[bool]]:
    """WHERE clauses limiting Document rows to those the user may access."""
    if is_admin(user):
        return []
    return [Document.project_id.in_(member_project_ids(user))]


async def ensure_project_access(db: AsyncSession, user: User, project_id: int) -> None:
    """404 if the project doesn't exist; 403 if the user isn't allowed in it."""
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if is_admin(user):
        return
    member = await db.get(ProjectMember, (project_id, user.id))
    if member is None:
        raise HTTPException(
            status_code=403, detail="You are not a member of this project"
        )


def build_permitted_doc_ids(user: User, project_id: int | None = None):
    """Scalar subquery of document ids the user may search.

    When project_id is given, only that project's documents are included.
    """
    query = select(Document.id).where(*document_access_filters(user))
    if project_id is not None:
        query = query.where(Document.project_id == project_id)
    return query.scalar_subquery()
