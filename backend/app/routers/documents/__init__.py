"""Document endpoints, mounted at /documents.
One file per `apiRoutes.documents.*` key.
"""

from fastapi import APIRouter

from .activate_version import router as _activate_version_router
from .document import router as _document_router
from .download import router as _download_router
from .list import router as _list_router
from .version import router as _version_router
from .versions import router as _versions_router

router = APIRouter()
router.routes.extend(_list_router.routes)
router.routes.extend(_document_router.routes)
router.routes.extend(_download_router.routes)
router.routes.extend(_versions_router.routes)
router.routes.extend(_version_router.routes)
router.routes.extend(_activate_version_router.routes)
