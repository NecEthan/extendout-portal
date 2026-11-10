"""Auth and HTTP client fixtures for router integration tests."""

import secrets
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, exists, select
from sqlalchemy.dialects.postgresql import insert

from app.main import app
from app.models.base import (
    Document,
    DocumentChunk,
    DocumentVersion,
    ProcessingJob,
    Project,
    ProjectMember,
    Session,
    User,
)
from app.services.auth import hash_password

# Shared project that test_user is a member of. Upload test documents here.
# A fixed id far above real ones (inserted explicitly; the identity is BY DEFAULT).
TEST_PROJECT_ID = 999_999
# An id no project has, for 404 tests.
UNKNOWN_PROJECT_ID = 2_000_000_000


async def _ensure_test_project(db) -> None:
    await db.execute(
        insert(Project)
        .values(id=TEST_PROJECT_ID, name="Test Project")
        .on_conflict_do_nothing()
    )


async def _delete_documents(db, doc_ids) -> None:
    """Delete documents (and their versions, chunks, jobs) matching a doc-id select."""
    version_ids = select(DocumentVersion.id).where(
        DocumentVersion.document_id.in_(doc_ids)
    )
    await db.execute(
        delete(DocumentChunk).where(DocumentChunk.document_version_id.in_(version_ids))
    )
    await db.execute(
        delete(ProcessingJob).where(ProcessingJob.document_version_id.in_(version_ids))
    )
    await db.execute(
        delete(DocumentVersion).where(DocumentVersion.document_id.in_(doc_ids))
    )
    await db.execute(delete(Document).where(Document.id.in_(doc_ids)))


async def _delete_test_project_if_unused(db) -> None:
    await db.execute(
        delete(Project)
        .where(Project.id == TEST_PROJECT_ID)
        .where(~exists().where(Document.project_id == TEST_PROJECT_ID))
    )


@pytest.fixture
async def test_user(db):
    user = User(
        email=f"test+{uuid.uuid4().hex[:8]}@example.com",
        password_hash=await hash_password("password"),
        role="builder",
    )
    db.add(user)
    await _ensure_test_project(db)
    await db.flush()
    db.add(ProjectMember(project_id=TEST_PROJECT_ID, user_id=user.id))
    await db.commit()
    await db.refresh(user)
    user_id = (
        user.id
    )  # capture before yield — expire_all() in tests makes user.id inaccessible

    yield user

    # Delete in FK order: chunks/jobs → versions → documents → sessions → user
    # (project memberships cascade with the user).
    await _delete_documents(db, select(Document.id).where(Document.owner_id == user_id))
    await db.execute(delete(Session).where(Session.user_id == user_id))
    await db.execute(delete(User).where(User.id == user_id))
    await _delete_test_project_if_unused(db)
    await db.commit()


@pytest.fixture
async def admin_user(db):
    user = User(
        email=f"admin+{uuid.uuid4().hex[:8]}@example.com",
        password_hash=await hash_password("password"),
        role="admin",
    )
    db.add(user)
    await _ensure_test_project(db)
    await db.commit()
    await db.refresh(user)
    user_id = user.id

    yield user

    # Delete in FK order: chunks/jobs → versions → documents → sessions → user
    # (project memberships cascade with the user).
    await _delete_documents(db, select(Document.id).where(Document.owner_id == user_id))
    await db.execute(delete(Session).where(Session.user_id == user_id))
    await db.execute(delete(User).where(User.id == user_id))
    await _delete_test_project_if_unused(db)
    await db.commit()


@pytest.fixture
async def make_project(db):
    """Factory for extra projects: make_project(member=user) -> project id.

    Pass member=None for a project the user is NOT a member of.
    """
    created: list[int] = []

    async def _make(member: User | None = None) -> int:
        project = Project(name=f"Test project {uuid.uuid4().hex[:8]}")
        db.add(project)
        await db.flush()
        project_id = project.id
        if member is not None:
            db.add(ProjectMember(project_id=project_id, user_id=member.id))
        await db.commit()
        created.append(project_id)
        return project_id

    yield _make

    if created:
        await _delete_documents(
            db, select(Document.id).where(Document.project_id.in_(created))
        )
        await db.execute(delete(Project).where(Project.id.in_(created)))
        await db.commit()


@pytest.fixture
async def admin_cookies(db, admin_user):
    token = secrets.token_urlsafe(32)
    session = Session(
        session_token=token,
        user_id=admin_user.id,
        expires_at=datetime.now(UTC) + timedelta(hours=1),
    )
    db.add(session)
    await db.commit()
    return {"eo_session": token}


@pytest.fixture
async def admin_client(admin_cookies):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies=admin_cookies,
    ) as c:
        yield c


@pytest.fixture
async def auth_cookies(db, test_user):
    token = secrets.token_urlsafe(32)
    session = Session(
        session_token=token,
        user_id=test_user.id,
        expires_at=datetime.now(UTC) + timedelta(hours=1),
    )
    db.add(session)
    await db.commit()
    return {"eo_session": token}


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


@pytest.fixture
async def auth_client(auth_cookies):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies=auth_cookies,
    ) as c:
        yield c
