"""Per-email login lockout: after `login_max_attempts` wrong passwords the
account is locked (429) for `login_lockout_seconds`, even for the right
password. Redis is replaced by an in-memory counter."""

import pytest

from app.config import settings
from app.limiter import limiter
from app.main import app


class FakeRedis:
    """Just the counter commands the login route uses."""

    def __init__(self):
        self.values: dict[str, int] = {}
        self.expiry: dict[str, int] = {}

    async def get(self, key):
        value = self.values.get(key)
        return None if value is None else str(value).encode()

    async def incr(self, key):
        self.values[key] = self.values.get(key, 0) + 1
        return self.values[key]

    async def expire(self, key, seconds):
        self.expiry[key] = seconds
        return True

    async def delete(self, key):
        self.values.pop(key, None)
        self.expiry.pop(key, None)
        return 1


@pytest.fixture
def redis():
    fake = FakeRedis()
    app.state.arq_pool = fake  # replaces the autouse AsyncMock for this test
    limiter.reset()  # keep the per-IP limit out of the way
    yield fake
    limiter.reset()


def _login(client, email, password):
    return client.post("/auth/login", json={"email": email, "password": password})


async def test_locks_after_seven_wrong_passwords(client, test_user, redis):
    assert settings.login_max_attempts == 7

    for _ in range(7):
        assert (await _login(client, test_user.email, "wrong")).status_code == 401

    # 8th attempt is refused, even with the right password.
    locked = await _login(client, test_user.email, "password")
    assert locked.status_code == 429
    assert locked.json()["detail"] == "Account temporarily locked"
    assert redis.expiry[f"login_fail:{test_user.email}"] == 900


async def test_correct_password_before_the_limit_resets_the_count(
    client, test_user, redis
):
    for _ in range(6):
        assert (await _login(client, test_user.email, "wrong")).status_code == 401

    assert (await _login(client, test_user.email, "password")).status_code == 200
    assert f"login_fail:{test_user.email}" not in redis.values
