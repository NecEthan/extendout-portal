"""Validation and storage keys for project site photos."""

import uuid

from fastapi import HTTPException, UploadFile

from app.config import settings

ALLOWED_PHOTO_TYPES = frozenset(["image/jpeg", "image/png", "image/webp"])


def detect_image_type(content: bytes) -> str | None:
    """Image type from the file's bytes (not its name or declared type)."""
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


async def read_and_validate_photo(file: UploadFile) -> tuple[bytes, str]:
    """Read the upload, enforce the size limit and check it's a real image.

    Returns (content_bytes, content_type). Raises HTTPException on violations.
    """
    max_bytes = settings.max_photo_size_mb * 1024 * 1024
    content: bytes = await file.read(max_bytes + 1)

    if len(content) == 0:
        raise HTTPException(status_code=422, detail="File is empty")
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Photo exceeds {settings.max_photo_size_mb} MB limit",
        )

    content_type = detect_image_type(content)
    if content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported image type. Upload a JPEG, PNG or WebP photo.",
        )
    return content, content_type


def generate_photo_storage_key() -> str:
    return f"photos/{uuid.uuid4()}"
