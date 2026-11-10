"""Retry and permanent failure tests."""

from unittest.mock import patch

import pytest
from arq import Retry
from sqlalchemy import select

from app.models.base import DocumentVersion, ProcessingJob
from app.workers.constants import MAX_TRIES
from app.workers.main import process_document
from tests.helpers.processing import DOC_TEXT, get_version, run_worker, upload_doc


async def test_process_document_retry_then_success(auth_client, db):
    """Transient failure on attempt 1 raises Retry; attempt 2 succeeds."""
    doc_id = await upload_doc(auth_client, "Retry Doc", DOC_TEXT, "policy.docx")
    version = await get_version(db, doc_id)
    version_id = version.id

    with patch(
        "app.workers.main.storage.download_bytes",
        side_effect=RuntimeError("connection reset"),
    ):
        with pytest.raises(Retry):
            await process_document({"job_try": 1}, str(version_id))

    db.expire_all()
    result = await db.execute(
        select(ProcessingJob).where(ProcessingJob.document_version_id == version_id)
    )
    assert result.scalar_one().attempts == 1

    await run_worker(version_id, DOC_TEXT, job_try=2)

    db.expire_all()
    result = await db.execute(
        select(DocumentVersion).where(DocumentVersion.id == version_id)
    )
    assert result.scalar_one().status == "ACTIVE"

    result = await db.execute(
        select(ProcessingJob).where(ProcessingJob.document_version_id == version_id)
    )
    job = result.scalar_one()
    assert job.status == "COMPLETE"
    assert job.attempts == 2


async def test_process_document_permanent_failure(auth_client, db):
    """All MAX_TRIES attempts fail → version=FAILED, job=FAILED."""
    doc_id = await upload_doc(auth_client, "Permanent Failure Doc", DOC_TEXT, "policy.docx")
    version = await get_version(db, doc_id)
    version_id = version.id

    error = RuntimeError("disk full")
    for attempt in range(1, MAX_TRIES):
        with patch("app.workers.main.storage.download_bytes", side_effect=error):
            with pytest.raises(Retry):
                await process_document({"job_try": attempt}, str(version_id))

    with patch("app.workers.main.storage.download_bytes", side_effect=error):
        with pytest.raises(RuntimeError, match="disk full"):
            await process_document({"job_try": MAX_TRIES}, str(version_id))

    db.expire_all()
    result = await db.execute(
        select(DocumentVersion).where(DocumentVersion.id == version_id)
    )
    assert result.scalar_one().status == "FAILED"

    result = await db.execute(
        select(ProcessingJob).where(ProcessingJob.document_version_id == version_id)
    )
    job = result.scalar_one()
    assert job.status == "FAILED"
    assert "disk full" in job.last_error

