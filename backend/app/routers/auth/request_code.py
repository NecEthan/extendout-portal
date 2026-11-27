"""POST /auth/request-code — email a 6-digit login code
(`apiRoutes.auth.requestCode`).

Answers the same whether or not the email has an account, so the form can't be
used to find out who does. Codes are only sent to accounts an admin created.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_arq_pool, get_db
from app.limiter import ip_key, limiter
from app.models.base import User
from app.routers.auth.errors import too_many
from app.schemas.auth import RequestCodeRequest
from app.services.email import EmailSendError, send_login_code
from app.services.login_codes import (
    code_request_wait_seconds,
    discard_code,
    issue_code,
    lockout_seconds_left,
    try_again_in,
)

router = APIRouter(tags=["auth"])

CODE_SENT = "If that email has an account, we've sent a login code to it."


@router.post("/request-code", status_code=202)
@limiter.limit(lambda: settings.login_rate_limit, key_func=ip_key)
async def request_code(
    request: Request,
    body: RequestCodeRequest,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_arq_pool),
) -> dict[str, str]:
    # Audited; the code itself is never recorded.
    request.state.audit_details = {"email": body.email}

    locked_for = await lockout_seconds_left(redis, body.email)
    if locked_for:
        raise too_many(
            f"Too many wrong codes, so sign-in is paused. {try_again_in(locked_for)}",
            locked_for,
        )
    wait = await code_request_wait_seconds(redis, body.email)
    if wait:
        raise too_many(
            f"You've asked for several codes. Use the newest one in your email, "
            f"or {try_again_in(wait).lower()}",
            wait,
        )

    user = await db.scalar(select(User).where(func.lower(User.email) == body.email))
    if user is not None:
        code = await issue_code(redis, body.email)
        try:
            await send_login_code(redis, body.email, user.name, code)
        except EmailSendError:
            await discard_code(redis, body.email)
            raise HTTPException(
                status_code=503,
                detail="We couldn't send the email. Try again in a minute.",
            )
    return {"detail": CODE_SENT}
