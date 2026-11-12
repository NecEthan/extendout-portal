"""Project endpoints, mounted at /projects. One file per `apiRoutes.projects.*` key."""

from fastapi import APIRouter

from .list import router as _list_router
from .member import router as _member_router
from .members import router as _members_router
from .photo import router as _photo_router
from .photo_file import router as _photo_file_router
from .photos import router as _photos_router
from .project import router as _project_router

router = APIRouter()
router.routes.extend(_list_router.routes)
router.routes.extend(_project_router.routes)
router.routes.extend(_members_router.routes)
router.routes.extend(_member_router.routes)
router.routes.extend(_photos_router.routes)
router.routes.extend(_photo_router.routes)
router.routes.extend(_photo_file_router.routes)
