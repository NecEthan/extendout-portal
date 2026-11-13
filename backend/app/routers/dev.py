"""GET /dev/outbox/{email} — the last login code "sent" to an email by the
``outbox`` email backend. Local development and E2E tests only: ``main.py``
mounts this only when ``email_backend == "outbox"``, which is refused outside
development."""

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_arq_pool
from app.schemas.auth import normalise_email
from app.services.email import outbox_key

router = APIRouter(tags=["dev"])


@router.get("/outbox/{email}")
async def read_outbox(email: str, redis=Depends(get_arq_pool)) -> dict[str, str]:
    code = await redis.get(outbox_key(normalise_email(email)))
    if code is None:
        raise HTTPException(status_code=404, detail="No code sent to that email")
    return {"code": code.decode() if isinstance(code, bytes) else code}
