import hashlib
import io
import uuid
import zipfile

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.document_version import DUPLICATE_CONTENT_INDEX

DUPLICATE_CONTENT_DETAIL = "Document with identical content already exists"
STORAGE_UNAVAILABLE_DETAIL = (
    "File storage is temporarily unavailable. Please try again in a few minutes."
)

_PDF = "application/pdf"
_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
_UNKNOWN = "application/octet-stream"

_PDF_MAGIC = b"%PDF"
_ZIP_MAGIC = b"PK\x03\x04"

# Uploads are restricted to PDF, Word (.docx) and Excel (.xlsx).
ALLOWED_CONTENT_TYPES: frozenset[str] = frozenset([_PDF, _DOCX, _XLSX])


async def read_and_validate(file: UploadFile) -> tuple[bytes, str]:
    """Read the upload, enforce size limit, detect real content type.

    Returns (content_bytes, detected_content_type).
    Raises HTTPException on violations.
    """
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    content: bytes = await file.read(max_bytes + 1)

    if len(content) == 0:
        raise HTTPException(status_code=422, detail="File is empty")

    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {settings.max_upload_size_mb} MB limit",
        )

    detected = detect_content_type(content)
    if detected not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                "Unsupported file type. "
                "Upload a PDF, Word (.docx) or Excel (.xlsx) file."
            ),
        )

    return content, detected


def detect_content_type(content: bytes) -> str:
    """Detect content type from the file's bytes (not its name or declared type).

    DOCX and XLSX are both zip archives, so they're told apart by their contents.
    Anything that isn't PDF, DOCX or XLSX is ``application/octet-stream``.
    """
    if content.startswith(_PDF_MAGIC):
        return _PDF
    if content.startswith(_ZIP_MAGIC):
        return _detect_office_type(content)
    return _UNKNOWN


def _detect_office_type(content: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            names = set(zf.namelist())
    except zipfile.BadZipFile:
        return _UNKNOWN
    if "word/document.xml" in names:
        return _DOCX
    if "xl/workbook.xml" in names:
        return _XLSX
    return _UNKNOWN


def compute_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def generate_storage_key() -> str:
    return f"documents/{uuid.uuid4()}"


async def assert_no_duplicate(
    db: AsyncSession, content_hash: str, project_id: int | None = None
) -> None:
    """Reject identical content within the same project (the same file may exist in
    different projects). FAILED versions don't count, so a failed upload can be
    retried with the same file.

    This gives a clean 409 before the file is stored. It can't stop two
    simultaneous uploads (both checks pass before either commits); the
    DUPLICATE_CONTENT_INDEX unique index catches that case at commit time.
    """
    from app.models.base import Document, DocumentVersion

    result = await db.execute(
        select(DocumentVersion)
        .join(Document, Document.id == DocumentVersion.document_id)
        .where(DocumentVersion.content_hash == content_hash)
        .where(DocumentVersion.status != "FAILED")
        .where(Document.project_id.is_not_distinct_from(project_id))
    )
    if result.scalars().first() is not None:
        raise HTTPException(status_code=409, detail=DUPLICATE_CONTENT_DETAIL)


def is_duplicate_content_error(exc: BaseException) -> bool:
    """True if ``exc`` is the unique-index violation for duplicate content."""
    return isinstance(exc, IntegrityError) and DUPLICATE_CONTENT_INDEX in str(exc.orig)


async def create_document_records(
    db: AsyncSession,
    title: str,
    content_hash: str,
    storage_key: str,
    current_user,
    project_id: int,
):
    from app.models.base import Document, DocumentVersion, ProcessingJob

    doc = Document(
        title=title,
        owner_id=current_user.id,
        source_type="upload",
        project_id=project_id,
    )
    db.add(doc)
    await db.flush()

    version = DocumentVersion(
        document_id=doc.id,
        version_number=1,
        status="PROCESSING",
        content_hash=content_hash,
        storage_key=storage_key,
        created_by=current_user.id,
        project_id=project_id,
    )
    db.add(version)
    await db.flush()

    job = ProcessingJob(document_version_id=version.id, status="QUEUED")
    db.add(job)
    await db.commit()

    return doc, version, job
