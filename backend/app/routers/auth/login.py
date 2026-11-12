"""POST /auth/login — check the password and start a session
(`apiRoutes.auth.login`).
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_arq_pool, get_db, set_request_user
from app.limiter import ip_key, limiter
from app.models.base import User
from app.schemas.auth import LoginRequest, UserResponse
from app.services.auth import (
    create_session,
    verify_password,
)

router = APIRouter(tags=["auth"])


@router.post("/login", response_model=UserResponse)
@limiter.limit(lambda: settings.login_rate_limit, key_func=ip_key)
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_arq_pool),
) -> UserResponse:
    # Audited on success and failure; the password is never recorded.
    request.state.audit_details = {"email": body.email}
    lockout_key = f"login_fail:{body.email}"
    fail_count = await redis.get(lockout_key)
    if fail_count and int(fail_count) >= settings.login_max_attempts:
        raise HTTPException(status_code=429, detail="Account temporarily locked")

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None or not await verify_password(body.password, user.password_hash):
        await redis.incr(lockout_key)
        await redis.expire(lockout_key, settings.login_lockout_seconds)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    await redis.delete(lockout_key)
    set_request_user(request, user)
    session = await create_session(db, user.id)
    await db.commit()
    is_production = settings.app_env != "development"
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session.session_token,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        max_age=settings.session_max_age_hours * 3600,  # 24 hours
        path="/",
    )
    return UserResponse.model_validate(user)
