"""POST /auth/logout — end the current session (`apiRoutes.auth.logout`)."""

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db, set_request_user
from app.services.auth import (
    get_valid_session,
    invalidate_session,
)

router = APIRouter(tags=["auth"])


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> None:
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        session = await get_valid_session(db, token)
        if session is not None:
            set_request_user(request, session.user)  # audit: who logged out
        await invalidate_session(db, token)
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        samesite="strict",
    )
