"""Database fixtures for router integration tests."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.dependencies import get_db
from app.main import app


@pytest.fixture
async def db():
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.fixture(autouse=True)
async def override_db():
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

    async def _get_test_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.pop(get_db, None)
    await engine.dispose()


@pytest.fixture(autouse=True)
async def audit_db_backend(monkeypatch):
    """Tests always audit to the database (the production path), through a
    NullPool session factory bound to this test's event loop."""
    from app.audit import writers

    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    monkeypatch.setattr(settings, "audit_backend", "db")
    monkeypatch.setattr(
        writers,
        "session_factory",
        async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False),
    )
    yield
    await engine.dispose()
