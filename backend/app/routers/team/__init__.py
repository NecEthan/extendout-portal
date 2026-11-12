"""Team endpoints (admin only), mounted at /team.
One file per `apiRoutes.team.*` key.
"""

from fastapi import APIRouter

from .list import router as _list_router
from .member import router as _member_router

router = APIRouter()
router.routes.extend(_list_router.routes)
router.routes.extend(_member_router.routes)
