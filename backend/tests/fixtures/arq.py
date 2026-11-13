"""ARQ pool fixtures for router integration tests."""

from unittest.mock import AsyncMock

import pytest

from app.dependencies import get_arq_pool
from app.main import app


class FakeRedis:
    """In-memory stand-in for the Redis commands the app uses directly (login
    codes, lockout, email outbox). Values come back as bytes, like real Redis.
    Expiry is recorded in ``ttl_seconds`` but not enforced; call ``expire_now``
    to simulate a key timing out."""

    def __init__(self):
        self.values: dict[str, bytes] = {}
        self.hashes: dict[str, dict[bytes, bytes]] = {}
        self.ttl_seconds: dict[str, int] = {}
        self.enqueue_job = AsyncMock(return_value=None)

    @staticmethod
    def _bytes(value) -> bytes:
        return value if isinstance(value, bytes) else str(value).encode()

    async def get(self, key):
        return self.values.get(key)

    async def set(self, key, value, ex=None):
        self.values[key] = self._bytes(value)
        if ex is not None:
            self.ttl_seconds[key] = ex
        return True

    async def incr(self, key):
        count = int(self.values.get(key, b"0")) + 1
        self.values[key] = self._bytes(count)
        return count

    async def expire(self, key, seconds):
        self.ttl_seconds[key] = seconds
        return True

    async def delete(self, *keys):
        deleted = 0
        for key in keys:
            found = key in self.values or key in self.hashes
            self.values.pop(key, None)
            self.hashes.pop(key, None)
            self.ttl_seconds.pop(key, None)
            deleted += int(found)
        return deleted

    async def hset(self, key, mapping):
        stored = self.hashes.setdefault(key, {})
        for field, value in mapping.items():
            stored[self._bytes(field)] = self._bytes(value)
        return len(mapping)

    async def hgetall(self, key):
        return dict(self.hashes.get(key, {}))

    async def hincrby(self, key, field, amount=1):
        stored = self.hashes.setdefault(key, {})
        count = int(stored.get(self._bytes(field), b"0")) + amount
        stored[self._bytes(field)] = self._bytes(count)
        return count

    def expire_now(self, key):
        self.values.pop(key, None)
        self.hashes.pop(key, None)
        self.ttl_seconds.pop(key, None)


@pytest.fixture(autouse=True)
def _arq_app_state():
    """Set app.state.arq_pool so get_arq_pool doesn't crash (lifespan doesn't run in tests)."""
    app.state.arq_pool = FakeRedis()
    yield
    try:
        del app.state._state["arq_pool"]
    except KeyError:
        pass


@pytest.fixture
def redis() -> FakeRedis:
    """The fake Redis behind get_arq_pool for this test."""
    return app.state.arq_pool


@pytest.fixture
def mock_pool():
    """Override the arq_pool dependency for tests that assert on enqueue_job calls."""
    pool = AsyncMock()
    pool.enqueue_job = AsyncMock(return_value=None)
    app.dependency_overrides[get_arq_pool] = lambda: pool
    yield pool
    app.dependency_overrides.pop(get_arq_pool, None)
