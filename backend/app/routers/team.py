"""Team router — admin only. Lists every user with their role and project
memberships, creates users, and lets admins change roles."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_admin
from app.models.base import User
from app.schemas.team import (
    CreateTeamMemberRequest,
    RoleUpdateRequest,
    TeamMemberResponse,
)
from app.services.auth import hash_password
from app.services.team import get_memberships, to_team_member_response

router = APIRouter(tags=["team"])


@router.get("", response_model=list[TeamMemberResponse])
async def list_team(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[TeamMemberResponse]:
    users = (
        (await db.execute(select(User).order_by(User.name.nulls_last(), User.email)))
        .scalars()
        .all()
    )
    memberships = await get_memberships(db, [u.id for u in users])
    return [to_team_member_response(u, memberships.get(u.id, [])) for u in users]


@router.post("", status_code=201, response_model=TeamMemberResponse)
async def create_team_member(
    body: CreateTeamMemberRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> TeamMemberResponse:
    """Admin creates an account. There is no public sign-up."""
    existing = await db.scalar(select(User).where(User.email == body.email))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=body.email,
        name=(body.name or "").strip() or None,
        password_hash=await hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return to_team_member_response(user, [])


@router.patch("/{user_id}", response_model=TeamMemberResponse)
async def update_role(
    user_id: uuid.UUID,
    body: RoleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> TeamMemberResponse:
    if user_id == admin.id:
        # Prevents an admin from locking themselves (or the last admin) out.
        raise HTTPException(status_code=400, detail="You can't change your own role")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = body.role
    await db.commit()
    memberships = await get_memberships(db, [user.id])
    return to_team_member_response(user, memberships.get(user.id, []))
