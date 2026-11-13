"""POST /auth/request-code — email a 6-digit login code
(`apiRoutes.auth.requestCode`).

Answers the same whether or not the email has an account, so the form can't be
used to find out who does. Codes are only sent to accounts an admin created.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_arq_pool, get_db
from app.limiter import ip_key, limiter
from app.models.base import User
from app.schemas.auth import RequestCodeRequest
from app.services.email import EmailSendError, send_login_code
from app.services.login_codes import (
    allow_code_request,
    discard_code,
    is_locked,
    issue_code,
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

    locked = await is_locked(redis, body.email)
    if locked:
        raise HTTPException(
            status_code=429,
            detail="Too many wrong codes. Wait 15 minutes and try again.",
        )
    allowed = await allow_code_request(redis, body.email)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many codes requested. Wait a few minutes and try again.",
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
