"""Team router — admin only. Lists every user with their role and project
memberships, creates users, edits them and deletes them."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_admin
from app.models.base import Document, DocumentVersion, Session, User
from app.schemas.team import (
    CreateTeamMemberRequest,
    TeamMemberResponse,
    TeamMemberUpdateRequest,
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
    request: Request,
    body: CreateTeamMemberRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> TeamMemberResponse:
    """Admin creates an account. There is no public sign-up."""
    request.state.audit_details = {"email": body.email, "role": body.role}
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
    request.state.audit_details["user_id"] = str(user.id)
    return to_team_member_response(user, [])


@router.patch("/{user_id}", response_model=TeamMemberResponse)
async def update_team_member(
    request: Request,
    user_id: uuid.UUID,
    body: TeamMemberUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> TeamMemberResponse:
    """Edit a user's name, email, role and/or password. Only fields sent change."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if body.role is not None and body.role != user.role and user.id == admin.id:
        # Prevents an admin from locking themselves (or the last admin) out.
        raise HTTPException(status_code=400, detail="You can't change your own role")

    changes: dict[str, object] = {}
    if body.email is not None:
        email = body.email.strip()
        if email != user.email:
            taken = await db.scalar(
                select(User.id).where(User.email == email, User.id != user.id)
            )
            if taken is not None:
                raise HTTPException(status_code=409, detail="Email already registered")
            changes["email"] = {"old": user.email, "new": email}
            user.email = email
    if "name" in body.model_fields_set:
        name = (body.name or "").strip() or None
        if name != user.name:
            changes["name"] = {"old": user.name, "new": name}
            user.name = name
    if body.role is not None and body.role != user.role:
        changes["role"] = {"old": user.role, "new": body.role}
        user.role = body.role
    if body.password is not None:
        changes["password"] = "reset"
        user.password_hash = await hash_password(body.password)
        if user.id != admin.id:
            # Sign them out everywhere so the old password's sessions end.
            await db.execute(delete(Session).where(Session.user_id == user.id))
    request.state.audit_details = {"changes": changes}

    await db.commit()
    memberships = await get_memberships(db, [user.id])
    return to_team_member_response(user, memberships.get(user.id, []))


@router.delete("/{user_id}", status_code=204)
async def delete_team_member(
    request: Request,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    """Delete an account. Their sessions and project memberships go with it;
    documents and photos they uploaded stay in their projects."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You can't delete yourself")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    request.state.audit_details = {"email": user.email, "role": user.role}
    # These foreign keys have no ON DELETE rule; keep the rows, drop the link.
    await db.execute(
        update(Document).where(Document.owner_id == user.id).values(owner_id=None)
    )
    await db.execute(
        update(DocumentVersion)
        .where(DocumentVersion.created_by == user.id)
        .values(created_by=None)
    )
    # Core DELETE: an ORM delete would lazy-load User.documents (fails in async).
    await db.execute(delete(User).where(User.id == user.id))
    await db.commit()
