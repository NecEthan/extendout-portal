"""Nightly backup of the file bucket to a second bucket.

Railway Storage Buckets have no versioning or backups, so a deleted file or a
lost bucket would otherwise be gone for good. Run as a Railway cron service:

    uv run python -m app.backup_bucket

Reads the source from STORAGE_* and the backup from BACKUP_STORAGE_* (see
app/config.py). Exits non-zero if anything failed, so Railway shows the run as
failed.

How it works:
- Copies every source object the backup doesn't have yet (or has with a
  different size). Keys are random UUIDs and files are never overwritten, so
  "missing" is all there is to check.
- A file deleted from the source is kept in the backup for
  BACKUP_KEEP_DELETED_DAYS, so a mistaken delete can be restored, then
  removed. The day each key was first seen missing is kept in a small JSON
  file in the backup bucket (STATE_KEY).
- If the source lists no files but the backup has some, it assumes the
  source is misconfigured and doesn't mark anything as deleted.

Restoring a file: copy `<key>` from the backup bucket back to the source
bucket under the same key (e.g. `mc cp` or `rclone copyto`).
"""

import io
import json
import sys
from dataclasses import dataclass, field
from datetime import date, timedelta

import structlog
from minio.error import S3Error

from app.config import settings
from app.logging_config import configure_logging
from app.services.storage import make_client

logger = structlog.get_logger(__name__)

STATE_KEY = "_backup/deleted.json"
_STATE_PREFIX = "_backup/"


@dataclass
class BackupResult:
    copied: list[str] = field(default_factory=list)
    failed: list[str] = field(default_factory=list)
    newly_missing: list[str] = field(default_factory=list)
    pruned: list[str] = field(default_factory=list)
    source_empty_guard: bool = False

    @property
    def ok(self) -> bool:
        return not self.failed and not self.source_empty_guard


def _list_sizes(client, bucket: str) -> dict[str, int]:
    return {
        obj.object_name: obj.size
        for obj in client.list_objects(bucket, recursive=True)
        if not obj.object_name.startswith(_STATE_PREFIX)
    }


def _read_state(client, bucket: str) -> dict[str, str]:
    try:
        response = client.get_object(bucket, STATE_KEY)
    except S3Error as exc:
        if exc.code == "NoSuchKey":
            return {}
        raise
    try:
        return json.loads(response.read())
    finally:
        response.close()
        response.release_conn()


def _write_state(client, bucket: str, state: dict[str, str]) -> None:
    data = json.dumps(state, indent=2, sort_keys=True).encode()
    client.put_object(
        bucket,
        STATE_KEY,
        io.BytesIO(data),
        length=len(data),
        content_type="application/json",
    )


def _copy(src, src_bucket: str, dst, dst_bucket: str, key: str, size: int) -> None:
    response = src.get_object(src_bucket, key)
    try:
        dst.put_object(
            dst_bucket,
            key,
            response,
            length=size,
            content_type=response.headers.get(
                "Content-Type", "application/octet-stream"
            ),
        )
    finally:
        response.close()
        response.release_conn()


def run_backup(
    src,
    src_bucket: str,
    dst,
    dst_bucket: str,
    keep_deleted_days: int,
    today: date,
) -> BackupResult:
    result = BackupResult()
    source = _list_sizes(src, src_bucket)
    backup = _list_sizes(dst, dst_bucket)

    for key, size in sorted(source.items()):
        if backup.get(key) == size:
            continue
        try:
            _copy(src, src_bucket, dst, dst_bucket, key, size)
            result.copied.append(key)
        except Exception:
            logger.exception("backup_copy_failed", key=key)
            result.failed.append(key)

    if not source and backup:
        logger.error(
            "backup_source_empty",
            detail="source bucket lists no files but the backup has some; "
            "check STORAGE_* settings. Nothing marked as deleted.",
            backup_files=len(backup),
        )
        result.source_empty_guard = True
        return result

    state = _read_state(dst, dst_bucket)
    # Files that came back (restored) are no longer missing.
    new_state = {k: v for k, v in state.items() if k not in source}
    cutoff = today - timedelta(days=keep_deleted_days)
    for key in sorted(set(backup) - set(source)):
        if key not in new_state:
            new_state[key] = today.isoformat()
            result.newly_missing.append(key)
        elif date.fromisoformat(new_state[key]) <= cutoff:
            try:
                dst.remove_object(dst_bucket, key)
                del new_state[key]
                result.pruned.append(key)
            except Exception:
                logger.exception("backup_prune_failed", key=key)
                result.failed.append(key)
    # Drop entries for files no longer in the backup either.
    new_state = {k: v for k, v in new_state.items() if k in backup}

    if new_state != state:
        _write_state(dst, dst_bucket, new_state)
    return result


def main() -> int:
    configure_logging(settings.app_env)
    required = {
        "BACKUP_STORAGE_ENDPOINT": settings.backup_storage_endpoint,
        "BACKUP_STORAGE_ACCESS_KEY": settings.backup_storage_access_key,
        "BACKUP_STORAGE_SECRET_KEY": settings.backup_storage_secret_key,
        "BACKUP_STORAGE_BUCKET": settings.backup_storage_bucket,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        logger.error("backup_not_configured", missing=missing)
        return 1

    src = make_client(
        settings.storage_endpoint,
        settings.storage_access_key,
        settings.storage_secret_key,
        region=settings.storage_region,
        virtual_style=settings.storage_virtual_style,
    )
    dst = make_client(
        settings.backup_storage_endpoint,
        settings.backup_storage_access_key,
        settings.backup_storage_secret_key,
        region=settings.backup_storage_region,
        virtual_style=settings.backup_storage_virtual_style,
    )
    result = run_backup(
        src,
        settings.storage_bucket,
        dst,
        settings.backup_storage_bucket,
        settings.backup_keep_deleted_days,
        date.today(),
    )
    logger.info(
        "backup_finished",
        copied=len(result.copied),
        failed=len(result.failed),
        newly_missing=len(result.newly_missing),
        pruned=len(result.pruned),
        ok=result.ok,
    )
    return 0 if result.ok else 1


if __name__ == "__main__":
    sys.exit(main())
