"""Auth endpoints, mounted at /auth. One file per `apiRoutes.auth.*` key."""

from fastapi import APIRouter

from .logout import router as _logout_router
from .request_code import router as _request_code_router
from .user import router as _user_router
from .verify_code import router as _verify_code_router

router = APIRouter()
router.routes.extend(_request_code_router.routes)
router.routes.extend(_verify_code_router.routes)
router.routes.extend(_logout_router.routes)
router.routes.extend(_user_router.routes)
