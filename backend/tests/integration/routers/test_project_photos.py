"""Integration tests for project site photos (MinIO mocked)."""

import io
import uuid
from unittest.mock import patch

import pytest
from PIL import Image
from sqlalchemy import delete, select, update

from app.models.base import ProjectPhoto, User
from tests.fixtures.auth import TEST_PROJECT_ID, UNKNOWN_PROJECT_ID


def _jpeg(color=(200, 120, 40)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), color).save(buf, format="JPEG")
    return buf.getvalue()


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), (0, 0, 255)).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(autouse=True)
async def cleanup_photos(db):
    yield
    await db.execute(
        delete(ProjectPhoto).where(ProjectPhoto.project_id == TEST_PROJECT_ID)
    )
    await db.commit()


async def _upload(client, project_id=TEST_PROJECT_ID, data=None, content=None):
    with patch("app.services.storage.upload_bytes") as upload:
        response = await client.post(
            f"/projects/{project_id}/photos",
            files={"file": ("site.jpg", content or _jpeg(), "image/jpeg")},
            data=data or {},
        )
    return response, upload


async def test_upload_photo_with_description(auth_client, db, test_user):
    response, upload = await _upload(
        auth_client, data={"description": "  Steel beam going in  "}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["description"] == "Steel beam going in"  # trimmed
    assert body["content_type"] == "image/jpeg"
    assert body["project_id"] == TEST_PROJECT_ID
    assert body["uploaded_by_name"] == test_user.email

    photo = await db.get(ProjectPhoto, uuid.UUID(body["id"]))
    assert photo.storage_key.startswith("photos/")
    upload.assert_called_once()
    assert upload.call_args.args[0] == photo.storage_key


async def test_description_is_optional(auth_client):
    response, _ = await _upload(auth_client)
    assert response.status_code == 201
    assert response.json()["description"] is None


async def test_blank_description_saved_as_none(auth_client):
    response, _ = await _upload(auth_client, data={"description": "   "})
    assert response.status_code == 201
    assert response.json()["description"] is None


async def test_description_too_long_rejected(auth_client):
    response, upload = await _upload(auth_client, data={"description": "x" * 501})
    assert response.status_code == 422
    upload.assert_not_called()


async def test_png_accepted(auth_client):
    response, _ = await _upload(auth_client, content=_png())
    assert response.status_code == 201
    assert response.json()["content_type"] == "image/png"


@pytest.mark.parametrize(
    "content",
    [b"%PDF-1.7 not an image", b"just some text", b"GIF89a....."],
)
async def test_non_image_rejected(auth_client, content):
    response, upload = await _upload(auth_client, content=content)
    assert response.status_code == 415
    upload.assert_not_called()


async def test_oversized_photo_rejected(auth_client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "max_photo_size_mb", 0)
    response, upload = await _upload(auth_client)
    assert response.status_code == 413
    upload.assert_not_called()


async def test_upload_requires_auth(client):
    response, _ = await _upload(client)
    assert response.status_code == 401


async def test_non_member_cannot_upload(auth_client, make_project):
    outsider = await make_project(member=None)
    response, upload = await _upload(auth_client, project_id=outsider)
    assert response.status_code == 403
    upload.assert_not_called()


async def test_unknown_project_404(auth_client):
    response, _ = await _upload(auth_client, project_id=UNKNOWN_PROJECT_ID)
    assert response.status_code == 404


async def test_upload_returns_503_when_storage_is_down(auth_client, db):
    with patch(
        "app.services.storage.upload_bytes",
        side_effect=ConnectionError("Connection refused"),
    ):
        response = await auth_client.post(
            f"/projects/{TEST_PROJECT_ID}/photos",
            files={"file": ("site.jpg", _jpeg(), "image/jpeg")},
        )
    assert response.status_code == 503
    result = await db.execute(
        select(ProjectPhoto).where(ProjectPhoto.project_id == TEST_PROJECT_ID)
    )
    assert result.scalars().all() == []


async def test_list_photos_newest_first(auth_client):
    first, _ = await _upload(auth_client, data={"description": "first"})
    second, _ = await _upload(
        auth_client, data={"description": "second"}, content=_jpeg((1, 2, 3))
    )

    response = await auth_client.get(f"/projects/{TEST_PROJECT_ID}/photos")
    assert response.status_code == 200
    ids = [p["id"] for p in response.json()]
    assert ids.index(second.json()["id"]) < ids.index(first.json()["id"])


async def test_non_member_cannot_list(auth_client, make_project):
    outsider = await make_project(member=None)
    response = await auth_client.get(f"/projects/{outsider}/photos")
    assert response.status_code == 403


async def test_get_photo_file(auth_client):
    content = _jpeg()
    uploaded, _ = await _upload(auth_client, content=content)
    photo_id = uploaded.json()["id"]

    with patch("app.services.storage.download_bytes", return_value=content):
        response = await auth_client.get(
            f"/projects/{TEST_PROJECT_ID}/photos/{photo_id}/file"
        )

    assert response.status_code == 200
    assert response.content == content
    assert response.headers["content-type"] == "image/jpeg"
    assert "private" in response.headers["cache-control"]
    # A disguised file can't be treated as HTML or run scripts.
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["content-security-policy"] == (
        "default-src 'none'; sandbox"
    )


async def test_get_photo_file_wrong_project_404(auth_client, make_project, test_user):
    uploaded, _ = await _upload(auth_client)
    other = await make_project(member=test_user)

    response = await auth_client.get(
        f"/projects/{other}/photos/{uploaded.json()['id']}/file"
    )
    assert response.status_code == 404


async def test_non_member_cannot_get_photo_file(
    auth_client, admin_client, make_project
):
    outsider = await make_project(member=None)
    uploaded, _ = await _upload(admin_client, project_id=outsider)

    response = await auth_client.get(
        f"/projects/{outsider}/photos/{uploaded.json()['id']}/file"
    )
    assert response.status_code == 403


async def test_stored_photo_has_location_metadata_removed(auth_client):
    img = Image.new("RGB", (40, 20), (10, 20, 30))
    exif = Image.Exif()
    exif[0x0110] = "iPhone 15"
    exif.get_ifd(0x8825)[2] = (51.0, 30.0, 12.0)  # GPS latitude
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)

    response, upload = await _upload(auth_client, content=buf.getvalue())

    assert response.status_code == 201
    stored = Image.open(io.BytesIO(upload.call_args.args[1]))  # bytes sent to MinIO
    assert dict(stored.getexif()) == {}
    assert dict(stored.getexif().get_ifd(0x8825)) == {}


async def test_corrupt_image_rejected(auth_client):
    corrupt = b"\xff\xd8\xff\xe0" + b"not really a jpeg" * 20
    response, upload = await _upload(auth_client, content=corrupt)
    assert response.status_code == 415
    upload.assert_not_called()


async def test_too_many_pixels_rejected(auth_client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "max_photo_pixels", 10)
    response, upload = await _upload(auth_client)  # 8x8 = 64 pixels
    assert response.status_code == 413
    upload.assert_not_called()


# ── Deleting ──────────────────────────────────────────────────────────────────


async def _delete(client, photo_id, project_id=TEST_PROJECT_ID):
    with patch("app.services.storage.delete_object") as delete_object:
        response = await client.delete(f"/projects/{project_id}/photos/{photo_id}")
    return response, delete_object


async def _set_role(db, user, role: str) -> None:
    await db.execute(update(User).where(User.id == user.id).values(role=role))
    await db.commit()


async def test_builder_can_delete_own_photo(auth_client, db):
    uploaded, _ = await _upload(auth_client)
    photo_id = uploaded.json()["id"]
    storage_key = (await db.get(ProjectPhoto, uuid.UUID(photo_id))).storage_key

    response, delete_object = await _delete(auth_client, photo_id)

    assert response.status_code == 204
    db.expire_all()
    assert await db.get(ProjectPhoto, uuid.UUID(photo_id)) is None
    delete_object.assert_called_once_with(storage_key)  # file removed from MinIO


async def test_builder_cannot_delete_someone_elses_photo(auth_client, admin_client, db):
    uploaded, _ = await _upload(admin_client)  # uploaded by the admin
    photo_id = uploaded.json()["id"]

    response, delete_object = await _delete(auth_client, photo_id)

    assert response.status_code == 403
    db.expire_all()
    assert await db.get(ProjectPhoto, uuid.UUID(photo_id)) is not None
    delete_object.assert_not_called()


async def test_client_can_delete_own_photo_but_not_others(
    auth_client, admin_client, db, test_user
):
    await _set_role(db, test_user, "client")
    own, _ = await _upload(auth_client)
    others, _ = await _upload(admin_client, content=_jpeg((9, 9, 9)))

    assert (await _delete(auth_client, own.json()["id"]))[0].status_code == 204
    assert (await _delete(auth_client, others.json()["id"]))[0].status_code == 403


async def test_admin_can_delete_any_photo(auth_client, admin_client, db):
    uploaded, _ = await _upload(auth_client)  # uploaded by the builder
    photo_id = uploaded.json()["id"]

    response, _ = await _delete(admin_client, photo_id)

    assert response.status_code == 204
    db.expire_all()
    assert await db.get(ProjectPhoto, uuid.UUID(photo_id)) is None


async def test_only_admin_can_delete_photo_of_deleted_user(
    auth_client, admin_client, db
):
    uploaded, _ = await _upload(auth_client)
    photo_id = uploaded.json()["id"]
    await db.execute(
        update(ProjectPhoto)
        .where(ProjectPhoto.id == uuid.UUID(photo_id))
        .values(uploaded_by=None)  # as if the uploader's account was deleted
    )
    await db.commit()

    assert (await _delete(auth_client, photo_id))[0].status_code == 403
    assert (await _delete(admin_client, photo_id))[0].status_code == 204


async def test_delete_photo_in_another_project_404(
    auth_client, make_project, test_user
):
    uploaded, _ = await _upload(auth_client)
    other = await make_project(member=test_user)

    response, _ = await _delete(auth_client, uploaded.json()["id"], project_id=other)
    assert response.status_code == 404


async def test_non_member_cannot_delete(auth_client, admin_client, make_project):
    outsider = await make_project(member=None)
    uploaded, _ = await _upload(admin_client, project_id=outsider)

    response, _ = await _delete(auth_client, uploaded.json()["id"], project_id=outsider)
    assert response.status_code == 403


async def test_delete_succeeds_even_if_file_removal_fails(auth_client, db):
    uploaded, _ = await _upload(auth_client)
    photo_id = uploaded.json()["id"]

    with patch(
        "app.services.storage.delete_object",
        side_effect=ConnectionError("MinIO down"),
    ):
        response = await auth_client.delete(
            f"/projects/{TEST_PROJECT_ID}/photos/{photo_id}"
        )

    assert response.status_code == 204  # gone for users; file is just an orphan
    db.expire_all()
    assert await db.get(ProjectPhoto, uuid.UUID(photo_id)) is None


async def test_can_delete_flag_in_list(auth_client, admin_client):
    own, _ = await _upload(auth_client)
    others, _ = await _upload(admin_client, content=_jpeg((5, 5, 5)))

    as_builder = {
        p["id"]: p["can_delete"]
        for p in (await auth_client.get(f"/projects/{TEST_PROJECT_ID}/photos")).json()
    }
    as_admin = {
        p["id"]: p["can_delete"]
        for p in (await admin_client.get(f"/projects/{TEST_PROJECT_ID}/photos")).json()
    }

    assert as_builder[own.json()["id"]] is True
    assert as_builder[others.json()["id"]] is False
    assert as_admin[own.json()["id"]] is True
    assert as_admin[others.json()["id"]] is True
    assert own.json()["can_delete"] is True  # upload response includes it too


async def test_heic_upload_is_stored_as_jpeg(auth_client, db):
    """iPhone photos (HEIC) are accepted and converted to JPEG."""
    buf = io.BytesIO()
    Image.new("RGB", (40, 20), (10, 120, 200)).save(buf, format="HEIF")
    response, upload = await _upload(auth_client, content=buf.getvalue())

    assert response.status_code == 201
    assert response.json()["content_type"] == "image/jpeg"
    _key, stored_bytes, stored_type = upload.call_args.args
    assert stored_type == "image/jpeg"
    assert Image.open(io.BytesIO(stored_bytes)).format == "JPEG"
