"""POST /auth/verify-code — log in with the emailed code and start a 400-day
session (`apiRoutes.auth.verifyCode`)."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_arq_pool, get_db, set_request_user
from app.limiter import ip_key, limiter
from app.models.base import User
from app.routers.auth.errors import too_many
from app.schemas.auth import UserResponse, VerifyCodeRequest
from app.services.auth import create_session
from app.services.login_codes import (
    check_code,
    clear_failures,
    lockout_seconds_left,
    record_failure,
    try_again_in,
)

router = APIRouter(tags=["auth"])


@router.post("/verify-code", response_model=UserResponse)
@limiter.limit(lambda: settings.login_rate_limit, key_func=ip_key)
async def verify_code(
    request: Request,
    body: VerifyCodeRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_arq_pool),
) -> UserResponse:
    # Audited on success and failure; the code itself is never recorded.
    request.state.audit_details = {"email": body.email}

    locked_for = await lockout_seconds_left(redis, body.email)
    if locked_for:
        raise too_many(
            f"Too many wrong codes, so sign-in is paused. {try_again_in(locked_for)}",
            locked_for,
        )

    user = None
    code_ok = await check_code(redis, body.email, body.code)
    if code_ok:
        user = await db.scalar(select(User).where(func.lower(User.email) == body.email))
    if user is None:
        await record_failure(redis, body.email)
        raise HTTPException(
            status_code=401,
            detail=(
                "That code is wrong or has expired. Check the email or send a new code."
            ),
        )

    await clear_failures(redis, body.email)
    set_request_user(request, user)
    session = await create_session(db, user.id)
    await db.commit()
    is_production = settings.app_env != "development"
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session.session_token,
        httponly=True,
        secure=is_production,
        # The site and API share a domain (portal. / api.extendout.co.uk),
        # so the cookie is first-party and Lax works everywhere.
        samesite="lax",
        max_age=settings.session_max_age_days * 24 * 3600,
        path="/",
    )
    return UserResponse.model_validate(user)
