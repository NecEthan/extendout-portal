"""GET/POST /team — list everyone, create an account (`apiRoutes.team.list`).
There is no public sign-up; this is the only way accounts are made."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import ColumnElement, and_, func, or_, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_admin
from app.models.base import User
from app.schemas.auth import UserRole
from app.schemas.team import (
    CreateTeamMemberRequest,
    RoleCounts,
    TeamListResponse,
    TeamMemberResponse,
)
from app.services.team import get_memberships, to_team_member_response

router = APIRouter(tags=["team"])


def _matches_search(search: str) -> ColumnElement[bool]:
    """Every word must appear in the name or email, ignoring case."""
    conditions = []
    for word in search.split():
        # Match % and _ literally, not as LIKE wildcards.
        pattern = (
            "%"
            + word.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            + "%"
        )
        conditions.append(
            or_(
                User.name.ilike(pattern, escape="\\"),
                User.email.ilike(pattern, escape="\\"),
            )
        )
    return and_(true(), *conditions)


@router.get("", response_model=TeamListResponse)
async def list_team(
    search: str = Query("", max_length=320),
    role: UserRole | Literal["all"] = "all",
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> TeamListResponse:
    """People matching ``search`` (name or email) and ``role``, A–Z by name
    (by email for people with no name), with per-role counts for the search."""
    matches = _matches_search(search)

    counts = {"all": 0, "admin": 0, "builder": 0, "client": 0}
    for user_role, count in (
        await db.execute(
            select(User.role, func.count()).where(matches).group_by(User.role)
        )
    ).all():
        counts[user_role] = count
        counts["all"] += count

    query = select(User).where(matches)
    if role != "all":
        query = query.where(User.role == role)
    sort_name = func.lower(func.coalesce(User.name, User.email))
    users = (await db.execute(query.order_by(sort_name, User.email))).scalars().all()
    memberships = await get_memberships(db, [u.id for u in users])
    return TeamListResponse(
        members=[to_team_member_response(u, memberships.get(u.id, [])) for u in users],
        counts=RoleCounts(**counts),
    )


@router.post("", status_code=201, response_model=TeamMemberResponse)
async def create_team_member(
    request: Request,
    body: CreateTeamMemberRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> TeamMemberResponse:
    """Admin creates an account. There is no public sign-up, and no password:
    they log in with a code emailed to them."""
    request.state.audit_details = {"email": body.email, "role": body.role}
    # body.email is already trimmed and lowercased by the schema.
    existing = await db.scalar(
        select(User.id).where(func.lower(User.email) == body.email)
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=body.email,
        name=(body.name or "").strip() or None,
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    request.state.audit_details["user_id"] = str(user.id)
    return to_team_member_response(user, [])
