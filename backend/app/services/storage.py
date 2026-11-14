"""File storage over the S3 API.

MinIO in local development and CI, a Railway Storage Bucket in production.
Both speak S3, so only the settings differ (see STORAGE_* in app/config.py).
"""

import io
from urllib.parse import urlparse

from minio import Minio
from minio.error import S3Error

from app.config import settings

_client_instance: Minio | None = None


def make_client(
    endpoint: str,
    access_key: str,
    secret_key: str,
    region: str | None = None,
    virtual_style: bool = False,
) -> Minio:
    """Build an S3 client.

    `endpoint` is a URL such as http://localhost:9000 or
    https://t3.storageapi.dev. `virtual_style` puts the bucket name in the
    host name (<bucket>.t3.storageapi.dev), which new Railway buckets
    require; MinIO uses the path (localhost:9000/<bucket>). Passing `region`
    skips the client's bucket-location lookup (Railway's region is "auto").
    """
    parsed = urlparse(endpoint)
    client = Minio(
        parsed.netloc,
        access_key=access_key,
        secret_key=secret_key,
        secure=parsed.scheme == "https",
        region=region or None,
    )
    if virtual_style:
        client.enable_virtual_style_endpoint()
    return client


def _client() -> Minio:
    global _client_instance
    if _client_instance is None:
        _client_instance = make_client(
            settings.storage_endpoint,
            settings.storage_access_key,
            settings.storage_secret_key,
            region=settings.storage_region,
            virtual_style=settings.storage_virtual_style,
        )
    return _client_instance


def upload_bytes(key: str, data: bytes, content_type: str) -> None:
    _client().put_object(
        settings.storage_bucket,
        key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )


def download_bytes(key: str) -> bytes:
    response = _client().get_object(settings.storage_bucket, key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def delete_object(key: str) -> None:
    try:
        _client().remove_object(settings.storage_bucket, key)
    except S3Error:
        pass
