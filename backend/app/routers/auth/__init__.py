"""Auth endpoints, mounted at /auth. One file per `apiRoutes.auth.*` key."""

from fastapi import APIRouter

from .login import router as _login_router
from .logout import router as _logout_router
from .user import router as _user_router

router = APIRouter()
router.routes.extend(_login_router.routes)
router.routes.extend(_logout_router.routes)
router.routes.extend(_user_router.routes)
