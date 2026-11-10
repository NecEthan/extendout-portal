"""Unit tests for storage helpers (MinIO client mocked)."""

from unittest.mock import MagicMock, patch

from minio.commonconfig import ENABLED, Filter
from minio.lifecycleconfig import Expiration, LifecycleConfig, Rule

from app.services.storage import remove_orphan_lifecycle_rule


def _rule(rule_id: str) -> Rule:
    return Rule(
        ENABLED,
        rule_filter=Filter(prefix="x/"),
        rule_id=rule_id,
        expiration=Expiration(days=1),
    )


def _run_with(config):
    client = MagicMock()
    client.get_bucket_lifecycle.return_value = config
    with patch("app.services.storage._client", return_value=client):
        remove_orphan_lifecycle_rule()
    return client


def test_removes_only_the_old_orphan_rule():
    client = _run_with(LifecycleConfig([_rule("expire-orphan-uploads"), _rule("keep")]))
    (_, kept), _ = client.set_bucket_lifecycle.call_args
    assert [r.rule_id for r in kept.rules] == ["keep"]
    client.delete_bucket_lifecycle.assert_not_called()


def test_deletes_lifecycle_when_old_rule_was_the_only_one():
    client = _run_with(LifecycleConfig([_rule("expire-orphan-uploads")]))
    client.delete_bucket_lifecycle.assert_called_once()
    client.set_bucket_lifecycle.assert_not_called()


def test_leaves_other_rules_alone():
    client = _run_with(LifecycleConfig([_rule("keep")]))
    client.set_bucket_lifecycle.assert_not_called()
    client.delete_bucket_lifecycle.assert_not_called()


def test_no_lifecycle_config_is_a_no_op():
    client = _run_with(None)
    client.set_bucket_lifecycle.assert_not_called()
    client.delete_bucket_lifecycle.assert_not_called()


def test_failure_is_logged_not_raised():
    client = MagicMock()
    client.get_bucket_lifecycle.side_effect = ConnectionError("MinIO down")
    with patch("app.services.storage._client", return_value=client):
        remove_orphan_lifecycle_rule()  # must not raise: app still starts
