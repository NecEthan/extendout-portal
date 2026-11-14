"""Unit tests for the S3 client setup (no network calls)."""

from minio import Minio

from app.services.storage import make_client


def _url(client: Minio, bucket: str, key: str) -> str:
    return client._base_url.build(
        method="GET", region="auto", bucket_name=bucket, object_name=key
    ).geturl()


def test_local_minio_uses_path_style_over_http():
    client = make_client("http://localhost:9000", "a", "b")
    assert _url(client, "files", "documents/x") == (
        "http://localhost:9000/files/documents/x"
    )


def test_railway_bucket_uses_virtual_hosted_style_over_https():
    client = make_client(
        "https://t3.storageapi.dev", "a", "b", region="auto", virtual_style=True
    )
    assert _url(client, "files-abc123", "photos/y") == (
        "https://files-abc123.t3.storageapi.dev/photos/y"
    )


def test_region_is_passed_so_no_location_lookup():
    client = make_client("https://t3.storageapi.dev", "a", "b", region="auto")
    assert client._base_url.region == "auto"


def test_empty_region_means_none():
    client = make_client("http://localhost:9000", "a", "b", region="")
    assert client._base_url.region is None
