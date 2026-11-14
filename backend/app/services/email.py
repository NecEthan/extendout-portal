"""Sending login codes by email.

- ``resend`` (production): Resend's REST API (https://resend.com), sending from
  ``EMAIL_FROM`` on ExtendOut's verified domain with ``RESEND_API_KEY``. Only
  ever runs here in the backend, never in the browser.
- ``outbox`` (local development and CI): nothing is sent. The code is logged and
  kept in Redis under ``email_outbox:<email>`` for ``GET /dev/outbox/{email}``.
  ``main.py`` refuses to start with it outside development.
"""

import html

import httpx
import structlog

from app.config import settings

logger = structlog.get_logger(__name__)

RESEND_SEND_URL = "https://api.resend.com/emails"


class EmailSendError(Exception):
    """The email service didn't accept the message."""


def outbox_key(email: str) -> str:
    return f"email_outbox:{email}"


def login_code_email(name: str | None, code: str) -> dict[str, str]:
    """Subject and bodies for a login-code email. The code is in the subject so
    it shows in phone notifications."""
    minutes = settings.login_code_ttl_seconds // 60
    greeting = f"Hi {name}," if name else "Hi,"
    text = (
        f"{greeting}\n\n"
        f"Your ExtendOut Portal login code is {code}\n\n"
        f"It expires in {minutes} minutes. If you didn't ask for it, you can "
        "ignore this email.\n"
    )
    page = (
        f"<p>{html.escape(greeting)}</p>"
        "<p>Your ExtendOut Portal login code is</p>"
        f'<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{code}</p>'
        f"<p>It expires in {minutes} minutes. If you didn't ask for it, you can "
        "ignore this email.</p>"
    )
    return {
        "subject": f"{code} is your ExtendOut Portal login code",
        "text": text,
        "html": page,
    }


async def send_login_code(redis, email: str, name: str | None, code: str) -> None:
    if settings.email_backend == "outbox":
        await redis.set(outbox_key(email), code, ex=settings.login_code_ttl_seconds)
        logger.info("login_code_outbox", email=email, code=code)
        return

    payload = {
        "from": settings.email_from,
        "to": [email],
        **login_code_email(name, code),
    }
    headers = {"Authorization": f"Bearer {settings.resend_api_key}"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(RESEND_SEND_URL, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("login_code_email_failed", error=str(exc))
        raise EmailSendError from exc
    if response.status_code != 200:
        # Resend answers with a short JSON reason; never log the code or key.
        logger.warning(
            "login_code_email_failed",
            status=response.status_code,
            reason=response.text[:200],
        )
        raise EmailSendError
    logger.info("login_code_emailed", email=email)
