"""Unit tests for the nightly bucket backup, against in-memory fake buckets."""

import io
import json
from datetime import date
from types import SimpleNamespace

from minio.error import S3Error

from app.backup_bucket import STATE_KEY, run_backup

TODAY = date(2026, 11, 14)


class _Response(io.BytesIO):
    def __init__(self, data: bytes, content_type: str):
        super().__init__(data)
        self.headers = {"Content-Type": content_type}

    def release_conn(self):
        pass


class FakeS3:
    """Just the client calls run_backup makes; one bucket per instance."""

    def __init__(self, objects: dict[str, bytes] | None = None):
        self.objects = {k: (v, "application/pdf") for k, v in (objects or {}).items()}
        self.fail_get: set[str] = set()

    def list_objects(self, bucket, recursive=False):
        return [
            SimpleNamespace(object_name=k, size=len(v))
            for k, (v, _) in self.objects.items()
        ]

    def get_object(self, bucket, key):
        if key in self.fail_get:
            raise ConnectionError("down")
        if key not in self.objects:
            raise S3Error(None, "NoSuchKey", "missing", key, "req", "host")
        data, content_type = self.objects[key]
        return _Response(data, content_type)

    def put_object(self, bucket, key, data, length, content_type):
        body = data.read()
        assert len(body) == length
        self.objects[key] = (body, content_type)

    def remove_object(self, bucket, key):
        self.objects.pop(key, None)

    def state(self) -> dict:
        if STATE_KEY not in self.objects:
            return {}
        return json.loads(self.objects[STATE_KEY][0])

    def files(self) -> set[str]:
        return {k for k in self.objects if k != STATE_KEY}


def _run(src, dst, today=TODAY, keep=30):
    return run_backup(src, "src", dst, "dst", keep, today)


def test_copies_new_files_with_content_type():
    src = FakeS3({"documents/a": b"pdf", "photos/b": b"jpg"})
    dst = FakeS3()
    result = _run(src, dst)
    assert sorted(result.copied) == ["documents/a", "photos/b"]
    assert dst.objects["documents/a"] == (b"pdf", "application/pdf")
    assert result.ok


def test_skips_files_already_backed_up():
    src = FakeS3({"documents/a": b"pdf"})
    dst = FakeS3({"documents/a": b"pdf"})
    assert _run(src, dst).copied == []


def test_recopies_when_size_differs():
    src = FakeS3({"documents/a": b"full file"})
    dst = FakeS3({"documents/a": b"part"})
    assert _run(src, dst).copied == ["documents/a"]
    assert dst.objects["documents/a"][0] == b"full file"


def test_deleted_file_is_kept_then_pruned_after_retention():
    src = FakeS3({"documents/keep": b"x"})
    dst = FakeS3({"documents/keep": b"x", "documents/gone": b"y"})

    first = _run(src, dst, today=date(2026, 11, 1))
    assert first.newly_missing == ["documents/gone"]
    assert dst.state() == {"documents/gone": "2026-11-01"}
    assert "documents/gone" in dst.files()

    # Still inside the 30 days: kept.
    _run(src, dst, today=date(2026, 11, 30))
    assert "documents/gone" in dst.files()

    # 30 days after it was first missing: removed, and dropped from the state.
    last = _run(src, dst, today=date(2026, 12, 1))
    assert last.pruned == ["documents/gone"]
    assert dst.files() == {"documents/keep"}
    assert dst.state() == {}


def test_restored_file_is_no_longer_marked_missing():
    src = FakeS3({})
    src.objects["documents/keep"] = (b"x", "application/pdf")
    dst = FakeS3({"documents/keep": b"x", "documents/a": b"y"})
    _run(src, dst)
    assert "documents/a" in dst.state()

    src.objects["documents/a"] = (b"y", "application/pdf")
    _run(src, dst)
    assert dst.state() == {}


def test_empty_source_with_files_in_backup_marks_nothing_and_fails():
    src = FakeS3()
    dst = FakeS3({"documents/a": b"x"})
    result = _run(src, dst)
    assert result.source_empty_guard
    assert not result.ok
    assert dst.state() == {}


def test_both_empty_is_fine():
    assert _run(FakeS3(), FakeS3()).ok


def test_one_failed_copy_does_not_stop_the_rest():
    src = FakeS3({"documents/bad": b"x", "documents/good": b"y"})
    src.fail_get.add("documents/bad")
    dst = FakeS3()
    result = _run(src, dst)
    assert result.failed == ["documents/bad"]
    assert result.copied == ["documents/good"]
    assert not result.ok
