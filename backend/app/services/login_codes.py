"""Login codes emailed to users, stored in Redis.

Keys (``email`` is already lowercased):
- ``login_code:<email>``: hash with ``hash`` (sha256 of email + code) and
  ``attempts``; expires after ``login_code_ttl_seconds``. Asking for a new code
  replaces it, and it is deleted once used or after too many wrong tries.
- ``login_code_requests:<email>``: codes requested in the current window.
- ``login_fail:<email>``: wrong codes in a row; at
  ``login_lockout_after_wrong_codes`` the email is locked for
  ``login_lockout_seconds`` (counted for unknown emails too).
"""

import hashlib
import hmac
import secrets

from app.config import settings


def _code_key(email: str) -> str:
    return f"login_code:{email}"


def _requests_key(email: str) -> str:
    return f"login_code_requests:{email}"


def _lockout_key(email: str) -> str:
    return f"login_fail:{email}"


def _hash(email: str, code: str) -> str:
    return hashlib.sha256(f"{email}:{code}".encode()).hexdigest()


async def is_locked(redis, email: str) -> bool:
    fail_count = await redis.get(_lockout_key(email))
    if fail_count is None:
        return False
    return int(fail_count) >= settings.login_lockout_after_wrong_codes


async def allow_code_request(redis, email: str) -> bool:
    """Count a code request; False once the email has asked too often."""
    key = _requests_key(email)
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, settings.login_code_window_seconds)
    return count <= settings.login_code_requests_per_window


async def issue_code(redis, email: str) -> str:
    """Create a new 6-digit code for the email, replacing any earlier one."""
    code = f"{secrets.randbelow(10**6):06d}"
    key = _code_key(email)
    await redis.delete(key)
    await redis.hset(key, mapping={"hash": _hash(email, code), "attempts": 0})
    await redis.expire(key, settings.login_code_ttl_seconds)
    return code


async def discard_code(redis, email: str) -> None:
    await redis.delete(_code_key(email))


async def check_code(redis, email: str, code: str) -> bool:
    """True if the code is right; it then can't be used again. A wrong code
    counts against the code, which is cancelled after
    ``login_code_cancel_after_wrong_tries``."""
    key = _code_key(email)
    stored = await redis.hgetall(key)
    stored_hash = stored.get(b"hash") or stored.get("hash")
    if not stored_hash:
        return False  # no code requested, expired, used or cancelled
    if isinstance(stored_hash, bytes):
        stored_hash = stored_hash.decode()

    if hmac.compare_digest(stored_hash, _hash(email, code)):
        # Only the request that deletes the key wins, so a code works once.
        deleted = await redis.delete(key)
        return deleted == 1

    attempts = await redis.hincrby(key, "attempts", 1)
    if attempts >= settings.login_code_cancel_after_wrong_tries:
        await redis.delete(key)
    return False


async def record_failure(redis, email: str) -> None:
    key = _lockout_key(email)
    await redis.incr(key)
    await redis.expire(key, settings.login_lockout_seconds)


async def clear_failures(redis, email: str) -> None:
    await redis.delete(_lockout_key(email))
