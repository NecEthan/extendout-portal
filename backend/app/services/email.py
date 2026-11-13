"""Sending login codes by email.

- ``emailjs`` (production): EmailJS REST API with the private key, so it only
  ever runs here in the backend. The template gets ``to_email``, ``to_name``,
  ``code`` and ``expires_minutes``.
- ``outbox`` (local development and CI): nothing is sent. The code is logged and
  kept in Redis under ``email_outbox:<email>`` for ``GET /dev/outbox/{email}``.
  ``main.py`` refuses to start with it outside development.
"""

import httpx
import structlog

from app.config import settings

logger = structlog.get_logger(__name__)

EMAILJS_SEND_URL = "https://api.emailjs.com/api/v1.0/email/send"


class EmailSendError(Exception):
    """The email service didn't accept the message."""


def outbox_key(email: str) -> str:
    return f"email_outbox:{email}"


async def send_login_code(redis, email: str, name: str | None, code: str) -> None:
    expires_minutes = settings.login_code_ttl_seconds // 60
    if settings.email_backend == "outbox":
        await redis.set(outbox_key(email), code, ex=settings.login_code_ttl_seconds)
        logger.info("login_code_outbox", email=email, code=code)
        return

    payload = {
        "service_id": settings.emailjs_service_id,
        "template_id": settings.emailjs_template_id,
        "user_id": settings.emailjs_public_key,
        "accessToken": settings.emailjs_private_key,
        "template_params": {
            "to_email": email,
            "to_name": name or email,
            "code": code,
            "expires_minutes": expires_minutes,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(EMAILJS_SEND_URL, json=payload)
    except httpx.HTTPError as exc:
        logger.warning("login_code_email_failed", error=str(exc))
        raise EmailSendError from exc
    if response.status_code != 200:
        # EmailJS answers with a short plain-text reason; never log the code.
        logger.warning(
            "login_code_email_failed",
            status=response.status_code,
            reason=response.text[:200],
        )
        raise EmailSendError
    logger.info("login_code_emailed", email=email)
