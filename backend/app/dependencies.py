from collections.abc import AsyncGenerator

import structlog
from arq.connections import ArqRedis
from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.base import User
from app.services.auth import get_valid_session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def get_arq_pool(request: Request) -> ArqRedis:
    return request.app.state.arq_pool


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await get_valid_session(db, token)
    if session is None:
        raise HTTPException(status_code=401, detail="Session invalid or expired")
    user = session.user
    # Bind user_id to the structlog context so it appears in all subsequent
    # log entries for this request.
    structlog.contextvars.bind_contextvars(user_id=str(user.id))
    set_request_user(request, user)
    return user


def set_request_user(request: Request, user: User) -> None:
    """Record who is making this request. The rate limiter keys per-user
    limits on user_id (app/limiter.py); the audit middleware records id,
    email, name and role as the actor (app/audit/middleware.py)."""
    request.state.user_id = str(user.id)
    request.state.user_email = user.email
    request.state.user_name = user.name
    request.state.user_role = user.role


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return current_user
