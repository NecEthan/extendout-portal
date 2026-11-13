"""Passwordless login: POST /auth/request-code emails a 6-digit code (the
"outbox" email backend stores it in fake Redis), POST /auth/verify-code logs in
with it and starts a 400-day session."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.config import settings
from app.limiter import limiter
from app.models.base import Session
from app.services.email import EmailSendError, outbox_key
from app.services.login_codes import issue_code

CODE_SENT = "If that email has an account, we've sent a login code to it."


@pytest.fixture(autouse=True)
def _reset_ip_limit():
    # The per-IP limit counts in real Redis; start each test with a clean slate.
    limiter.reset()
    yield
    limiter.reset()


def _request_code(client, email):
    return client.post("/auth/request-code", json={"email": email})


def _verify(client, email, code):
    return client.post("/auth/verify-code", json={"email": email, "code": code})


async def _sent_code(redis, email) -> str:
    return (await redis.get(outbox_key(email.lower()))).decode()


async def _wrong_code(redis, email) -> str:
    right = await _sent_code(redis, email)
    return "000000" if right != "000000" else "111111"


# ── Requesting a code ─────────────────────────────────────────────────────────


async def test_code_is_sent_to_an_existing_account(client, test_user, redis):
    response = await _request_code(client, test_user.email)
    assert response.status_code == 202
    assert response.json() == {"detail": CODE_SENT}

    code = await _sent_code(redis, test_user.email)
    assert len(code) == 6 and code.isdigit()
    assert redis.ttl_seconds[f"login_code:{test_user.email}"] == 600


async def test_unknown_email_gets_the_same_answer_but_no_code(client, redis):
    response = await _request_code(client, "nobody@example.com")
    assert response.status_code == 202
    assert response.json() == {"detail": CODE_SENT}
    assert await redis.get(outbox_key("nobody@example.com")) is None
    assert "login_code:nobody@example.com" not in redis.hashes


async def test_email_is_case_insensitive(client, test_user, redis):
    shouty = f"  {test_user.email.upper()} "
    assert (await _request_code(client, shouty)).status_code == 202
    code = await _sent_code(redis, test_user.email)

    response = await _verify(client, shouty, code)
    assert response.status_code == 200
    assert response.json()["email"] == test_user.email


async def test_too_many_code_requests_are_refused(client, test_user):
    for _ in range(3):
        assert (await _request_code(client, test_user.email)).status_code == 202
    response = await _request_code(client, test_user.email)
    assert response.status_code == 429
    assert "Too many codes requested" in response.json()["detail"]


async def test_email_failure_is_reported_and_no_code_is_left(client, test_user, redis):
    with patch(
        "app.routers.auth.request_code.send_login_code", side_effect=EmailSendError
    ):
        response = await _request_code(client, test_user.email)
    assert response.status_code == 503
    assert f"login_code:{test_user.email}" not in redis.hashes


# ── Logging in with it ────────────────────────────────────────────────────────


async def test_correct_code_logs_in_for_400_days(client, db, test_user, redis):
    await _request_code(client, test_user.email)
    code = await _sent_code(redis, test_user.email)

    response = await _verify(client, test_user.email, code)
    assert response.status_code == 200
    assert response.json()["id"] == str(test_user.id)
    assert f"Max-Age={400 * 24 * 3600}" in response.headers["set-cookie"]

    session = await db.scalar(select(Session).where(Session.user_id == test_user.id))
    expected = datetime.now(UTC) + timedelta(days=400)
    assert abs(session.expires_at - expected) < timedelta(minutes=1)

    assert (await client.get("/auth/user")).status_code == 200


async def test_a_code_works_only_once(client, test_user, redis):
    await _request_code(client, test_user.email)
    code = await _sent_code(redis, test_user.email)
    assert (await _verify(client, test_user.email, code)).status_code == 200
    assert (await _verify(client, test_user.email, code)).status_code == 401


async def test_wrong_code_is_refused(client, test_user, redis):
    await _request_code(client, test_user.email)
    wrong = await _wrong_code(redis, test_user.email)
    response = await _verify(client, test_user.email, wrong)
    assert response.status_code == 401
    assert "wrong or has expired" in response.json()["detail"]


async def test_code_is_cancelled_after_five_wrong_tries(client, test_user, redis):
    await _request_code(client, test_user.email)
    right = await _sent_code(redis, test_user.email)
    wrong = await _wrong_code(redis, test_user.email)
    for _ in range(settings.login_code_cancel_after_wrong_tries):
        assert (await _verify(client, test_user.email, wrong)).status_code == 401
    assert (await _verify(client, test_user.email, right)).status_code == 401


async def test_new_code_replaces_the_old_one(client, test_user, redis):
    await _request_code(client, test_user.email)
    old = await _sent_code(redis, test_user.email)
    await _request_code(client, test_user.email)
    new = await _sent_code(redis, test_user.email)
    if old != new:  # 1 in a million they match
        assert (await _verify(client, test_user.email, old)).status_code == 401
    assert (await _verify(client, test_user.email, new)).status_code == 200


async def test_expired_code_is_refused(client, test_user, redis):
    await _request_code(client, test_user.email)
    code = await _sent_code(redis, test_user.email)
    redis.expire_now(f"login_code:{test_user.email}")
    assert (await _verify(client, test_user.email, code)).status_code == 401


async def test_code_must_be_six_digits(client, test_user):
    for bad in ("12345", "1234567", "abcdef", ""):
        response = await _verify(client, test_user.email, bad)
        assert response.status_code == 422, bad


# ── Lockout ───────────────────────────────────────────────────────────────────


async def test_locks_after_seven_wrong_codes(client, test_user, redis):
    assert settings.login_lockout_after_wrong_codes == 7
    for _ in range(7):
        assert (await _verify(client, test_user.email, "000000")).status_code == 401
    assert redis.ttl_seconds[f"login_fail:{test_user.email}"] == 900

    # Locked: no new code is sent, and even a valid code is refused.
    response = await _request_code(client, test_user.email)
    assert response.status_code == 429
    assert "Too many wrong codes" in response.json()["detail"]
    code = await issue_code(redis, test_user.email)
    assert (await _verify(client, test_user.email, code)).status_code == 429


async def test_successful_login_resets_the_wrong_code_count(client, test_user, redis):
    for _ in range(6):
        await _verify(client, test_user.email, "000000")
    await _request_code(client, test_user.email)
    code = await _sent_code(redis, test_user.email)
    assert (await _verify(client, test_user.email, code)).status_code == 200
    assert await redis.get(f"login_fail:{test_user.email}") is None


# ── Dev outbox ────────────────────────────────────────────────────────────────


async def test_dev_outbox_returns_the_last_code(client, test_user, redis):
    await _request_code(client, test_user.email)
    code = await _sent_code(redis, test_user.email)
    response = await client.get(f"/dev/outbox/{test_user.email.upper()}")
    assert response.status_code == 200
    assert response.json() == {"code": code}
    assert (await client.get("/dev/outbox/nobody@example.com")).status_code == 404
