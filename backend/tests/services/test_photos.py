"""Unit tests for photo metadata stripping."""

import io

import pytest
from fastapi import HTTPException
from PIL import Image

from app.services.photos import strip_metadata

GPS_IFD = 0x8825


def _phone_photo(fmt: str = "JPEG", size=(40, 20), orientation: int = 6) -> bytes:
    """A photo with the metadata a phone adds: make, model, GPS, orientation."""
    img = Image.new("RGB", size, (200, 100, 50))
    exif = Image.Exif()
    exif[0x010F] = "Apple"  # Make
    exif[0x0110] = "iPhone 15"  # Model
    exif[0x0112] = orientation  # 6 = rotate 90° clockwise to display
    gps = exif.get_ifd(GPS_IFD)
    gps[1], gps[2] = "N", (51.0, 30.0, 12.0)
    gps[3], gps[4] = "W", (0.0, 7.0, 39.0)
    buf = io.BytesIO()
    img.save(buf, format=fmt, exif=exif)
    return buf.getvalue()


def _open(content: bytes) -> Image.Image:
    return Image.open(io.BytesIO(content))


@pytest.mark.parametrize(
    "fmt,content_type",
    [("JPEG", "image/jpeg"), ("PNG", "image/png"), ("WEBP", "image/webp")],
)
def test_removes_gps_and_camera_metadata(fmt, content_type):
    original = _phone_photo(fmt)
    assert _open(original).getexif().get_ifd(GPS_IFD)  # sanity: GPS present

    cleaned = _open(strip_metadata(original, content_type))

    assert dict(cleaned.getexif()) == {}
    assert dict(cleaned.getexif().get_ifd(GPS_IFD)) == {}
    assert cleaned.format == fmt  # same format as uploaded


def test_rotates_photo_upright_before_dropping_orientation():
    cleaned = _open(strip_metadata(_phone_photo(size=(40, 20)), "image/jpeg"))
    assert cleaned.size == (20, 40)  # turned 90°, as the phone intended


def test_keeps_colour_profile():
    img = Image.new("RGB", (8, 8))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", icc_profile=b"fake-icc-profile")
    cleaned = _open(strip_metadata(buf.getvalue(), "image/jpeg"))
    assert cleaned.info.get("icc_profile") == b"fake-icc-profile"


def test_rejects_too_many_pixels(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "max_photo_pixels", 100)
    with pytest.raises(HTTPException) as exc:
        strip_metadata(_phone_photo(size=(40, 20)), "image/jpeg")  # 800 px
    assert exc.value.status_code == 413


def test_rejects_corrupt_image():
    corrupt = b"\xff\xd8\xff\xe0" + b"not really a jpeg" * 20
    with pytest.raises(HTTPException) as exc:
        strip_metadata(corrupt, "image/jpeg")
    assert exc.value.status_code == 415
