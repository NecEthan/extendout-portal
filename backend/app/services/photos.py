"""Validation and storage keys for project site photos."""

import io
import uuid

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener

from app.config import settings

# Lets Pillow open HEIC/HEIF, the default format of iPhone photos.
register_heif_opener()

ALLOWED_PHOTO_TYPES = frozenset(["image/jpeg", "image/png", "image/webp", "image/heic"])

# HEIF "ftyp" brands used by iPhone and other phone photos.
_HEIC_BRANDS = frozenset(
    [b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis", b"mif1", b"msf1"]
)

UNSUPPORTED_PHOTO_DETAIL = (
    "Unsupported image type. Upload a JPEG, PNG, WebP or HEIC photo."
)


def detect_image_type(content: bytes) -> str | None:
    """Image type from the file's bytes (not its name or declared type)."""
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    if content[4:8] == b"ftyp" and content[8:12] in _HEIC_BRANDS:
        return "image/heic"
    return None


def stored_content_type(content_type: str) -> str:
    """Type the photo is stored as. HEIC is converted to JPEG, since most
    browsers (Chrome, Firefox, Edge) can't display HEIC."""
    return "image/jpeg" if content_type == "image/heic" else content_type


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
        raise HTTPException(status_code=415, detail=UNSUPPORTED_PHOTO_DETAIL)
    return content, content_type


_PIL_FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


def strip_metadata(content: bytes, content_type: str) -> bytes:
    """Re-save the photo without its hidden metadata (EXIF), as
    ``stored_content_type(content_type)`` (HEIC becomes JPEG).

    Phone photos carry the exact GPS location, time taken and phone model;
    location is personal data, so it's removed before the photo is stored.
    The photo is rotated upright first, since "which way up" is stored in
    that same metadata and would otherwise be lost (photos would show
    sideways). Decoding also proves the file is a real, readable image.

    CPU-bound: call it in a worker thread, not on the event loop.
    Raises HTTPException 413 (too many pixels) or 415 (unreadable image).
    """
    try:
        with Image.open(io.BytesIO(content)) as img:
            # Image.open only reads the header, so the size is known before
            # any pixels are decoded.
            if img.width * img.height > settings.max_photo_pixels:
                raise HTTPException(
                    status_code=413,
                    detail=(
                        "Photo resolution is too high (max "
                        f"{settings.max_photo_pixels // 1_000_000} megapixels)"
                    ),
                )
            upright = ImageOps.exif_transpose(img)
            out_type = stored_content_type(content_type)
            if out_type == "image/jpeg" and upright.mode not in ("RGB", "L"):
                upright = upright.convert("RGB")  # JPEG has no alpha channel

            # Keep the colour profile so colours look the same; everything
            # else (EXIF, GPS, text chunks) is dropped by not passing it on.
            options = {}
            icc_profile = img.info.get("icc_profile")
            if icc_profile:
                options["icc_profile"] = icc_profile
            if out_type in ("image/jpeg", "image/webp"):
                options["quality"] = 90

            out = io.BytesIO()
            upright.save(out, format=_PIL_FORMATS[out_type], **options)
            return out.getvalue()
    except HTTPException:
        raise
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
    ) as exc:
        raise HTTPException(
            status_code=415,
            detail=(
                "The photo couldn't be read. "
                "Upload a valid JPEG, PNG, WebP or HEIC photo."
            ),
        ) from exc


def generate_photo_storage_key() -> str:
    return f"photos/{uuid.uuid4()}"
