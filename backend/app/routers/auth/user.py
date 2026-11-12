"""GET /auth/user — the logged-in user (`apiRoutes.auth.user`)."""

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models.base import User
from app.schemas.auth import UserResponse

router = APIRouter(tags=["auth"])


@router.get("/user", response_model=UserResponse)
async def get_user(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    return UserResponse.model_validate(current_user)
