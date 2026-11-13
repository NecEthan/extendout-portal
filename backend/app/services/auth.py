import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.base import Session


async def create_session(db: AsyncSession, user_id: uuid.UUID) -> Session:
    token = secrets.token_urlsafe(32)
    now = datetime.now(UTC)
    session = Session(
        session_token=token,
        user_id=user_id,
        expires_at=now + timedelta(days=settings.session_max_age_days),
    )
    db.add(session)
    return session


async def get_valid_session(db: AsyncSession, token: str) -> Session | None:
    result = await db.execute(
        select(Session)
        .where(Session.session_token == token)
        .where(Session.expires_at > func.now())
        .options(selectinload(Session.user))
    )
    session = result.scalar_one_or_none()
    if session is None:
        return None
    await db.commit()
    return session


async def invalidate_session(db: AsyncSession, token: str) -> None:
    result = await db.execute(select(Session).where(Session.session_token == token))
    session = result.scalar_one_or_none()
    if session is not None:
        await db.delete(session)
        await db.commit()
