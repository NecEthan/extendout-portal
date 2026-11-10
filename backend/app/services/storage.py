import io
import logging
from urllib.parse import urlparse

from minio import Minio
from minio.error import S3Error
from minio.lifecycleconfig import LifecycleConfig

from app.config import settings

logger = logging.getLogger(__name__)

_client_instance: Minio | None = None


def _client() -> Minio:
    global _client_instance
    if _client_instance is None:
        parsed = urlparse(settings.storage_endpoint)
        _client_instance = Minio(
            parsed.netloc,
            access_key=settings.storage_access_key,
            secret_key=settings.storage_secret_key,
            secure=parsed.scheme == "https",
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


# A lifecycle rule this app used to create. It deleted uploads still tagged
# as orphans after a day, which could also delete a real file if the tag
# removal after a successful upload was missed. Removed; see
# "Orphaned files in MinIO" in docs/engineering-decisions.md.
_OLD_ORPHAN_RULE_ID = "expire-orphan-uploads"


def remove_orphan_lifecycle_rule() -> None:
    """Remove the old orphan-expiry rule from the bucket, if it's still there.

    The rule lives in MinIO, not in this code, so it keeps deleting tagged
    files until it's removed. Other lifecycle rules on the bucket are kept.
    Called at startup; idempotent and best-effort (failure is logged).
    """
    try:
        client = _client()
        config = client.get_bucket_lifecycle(settings.storage_bucket)
        if config is None:
            return
        remaining = [r for r in config.rules if r.rule_id != _OLD_ORPHAN_RULE_ID]
        if len(remaining) == len(config.rules):
            return
        if remaining:
            client.set_bucket_lifecycle(
                settings.storage_bucket, LifecycleConfig(remaining)
            )
        else:
            client.delete_bucket_lifecycle(settings.storage_bucket)
        logger.info(
            "Removed lifecycle rule %s from bucket %s",
            _OLD_ORPHAN_RULE_ID,
            settings.storage_bucket,
        )
    except Exception:
        logger.warning("remove_orphan_lifecycle_rule failed", exc_info=True)
