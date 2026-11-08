"""Rate limiting (slowapi + Redis).

Three ways to key a limit:

- ``ip_key``: per client IP. Only for login, where nobody is signed in yet.
- ``user_key``: per signed-in user. Used by route decorators, which run after
  FastAPI resolves ``get_current_user`` (it sets ``request.state.user_id``).
- ``session_or_ip_key``: per session cookie (hashed). Used by the global
  backstop, which runs as an app-wide dependency before ``get_current_user``,
  so the user isn't known yet; one login session is close enough to one user.
"""

import hashlib

from fastapi import HTTPException
from limits import parse
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.config import settings

ip_key = get_remote_address


def user_key(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    return f"user:{user_id}" if user_id else f"ip:{get_remote_address(request)}"


def session_or_ip_key(request: Request) -> str:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return f"ip:{get_remote_address(request)}"
    # Hash so raw session tokens never end up as Redis keys.
    return f"session:{hashlib.sha256(token.encode()).hexdigest()[:16]}"


# Limits are callables (read per request, not parsed once at import) so tests
# can lower them by patching ``settings``.
limiter = Limiter(key_func=session_or_ip_key, storage_uri=settings.redis_url)

# One bucket shared by new documents and new versions: 30/min covers both.
upload_limit = limiter.shared_limit(
    lambda: settings.upload_rate_limit, scope="uploads", key_func=user_key
)


# Routes that must never be throttled by the backstop. Docker checks every few seconds
_BACKSTOP_EXEMPT_PATHS = {"/health"}


def global_rate_limit(request: Request) -> None:
    """App-wide backstop (registered on the FastAPI app): catches a client stuck
    in a loop. Well above normal use; routes with their own limits count too.

    Done as a dependency, not slowapi's SlowAPIMiddleware: that middleware looks
    routes up in ``app.routes``, which FastAPI >= 0.141 nests, so it silently
    skipped every route.
    """
    if request.url.path in _BACKSTOP_EXEMPT_PATHS:
        return
    limit = parse(settings.global_rate_limit)
    # hit() records this request and returns True if still within the limit.
    allowed = limiter.limiter.hit(limit, "global", session_or_ip_key(request))
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded: {limit}")
