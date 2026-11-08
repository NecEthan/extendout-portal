"""Helpers for the Team page: project memberships and response building."""

import uuid
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import ProjectMember, User
from app.schemas.team import TeamMemberResponse


async def get_memberships(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[int]]:
    """Map each user id to the ids of the projects they belong to."""
    query = select(ProjectMember.user_id, ProjectMember.project_id).where(
        ProjectMember.user_id.in_(user_ids)
    )
    by_user: dict[uuid.UUID, list[int]] = defaultdict(list)
    for user_id, project_id in (
        await db.execute(query.order_by(ProjectMember.project_id))
    ).all():
        by_user[user_id].append(project_id)
    return by_user


def to_team_member_response(user: User, project_ids: list[int]) -> TeamMemberResponse:
    return TeamMemberResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        project_ids=project_ids,
    )
