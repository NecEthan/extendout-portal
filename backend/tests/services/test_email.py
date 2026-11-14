"""send_login_code: the Resend request, failures, and the outbox backend."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.config import settings
from app.services.email import (
    RESEND_SEND_URL,
    EmailSendError,
    login_code_email,
    outbox_key,
    send_login_code,
)
from tests.fixtures.arq import FakeRedis

SENDER = "ExtendOut Portal <portal@mail.example.com>"


@pytest.fixture
def resend(monkeypatch):
    monkeypatch.setattr(settings, "email_backend", "resend")
    monkeypatch.setattr(settings, "resend_api_key", "re_test_key")
    monkeypatch.setattr(settings, "email_from", SENDER)


def _client_returning(response):
    client = MagicMock()
    client.post = AsyncMock(return_value=response)
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=client)
    context.__aexit__ = AsyncMock(return_value=False)
    return client, context


async def test_resend_request(resend):
    client, context = _client_returning(httpx.Response(200, json={"id": "e_1"}))
    with patch("app.services.email.httpx.AsyncClient", return_value=context):
        await send_login_code(FakeRedis(), "sam@example.com", "Sam", "482913")

    client.post.assert_awaited_once()
    args, kwargs = client.post.await_args
    assert args == (RESEND_SEND_URL,)
    assert kwargs["headers"] == {"Authorization": "Bearer re_test_key"}
    sent = kwargs["json"]
    assert sent["from"] == SENDER
    assert sent["to"] == ["sam@example.com"]
    assert sent["subject"] == "482913 is your ExtendOut Portal login code"
    assert "482913" in sent["text"] and "482913" in sent["html"]
    assert "Hi Sam," in sent["text"]


async def test_resend_rejection_raises(resend):
    _, context = _client_returning(httpx.Response(422, json={"message": "bad from"}))
    with patch("app.services.email.httpx.AsyncClient", return_value=context):
        with pytest.raises(EmailSendError):
            await send_login_code(FakeRedis(), "sam@example.com", "Sam", "482913")


async def test_resend_network_error_raises(resend):
    client, context = _client_returning(None)
    client.post = AsyncMock(side_effect=httpx.ConnectError("down"))
    with patch("app.services.email.httpx.AsyncClient", return_value=context):
        with pytest.raises(EmailSendError):
            await send_login_code(FakeRedis(), "sam@example.com", "Sam", "482913")


def test_email_without_a_name_and_names_are_escaped():
    assert login_code_email(None, "123456")["text"].startswith("Hi,\n")
    page = login_code_email("<b>Sam</b>", "123456")["html"]
    assert "&lt;b&gt;Sam&lt;/b&gt;" in page and "<b>Sam</b>" not in page


async def test_outbox_stores_the_code_and_sends_nothing(monkeypatch):
    monkeypatch.setattr(settings, "email_backend", "outbox")
    redis = FakeRedis()
    with patch("app.services.email.httpx.AsyncClient") as client_cls:
        await send_login_code(redis, "sam@example.com", "Sam", "482913")
    client_cls.assert_not_called()
    assert await redis.get(outbox_key("sam@example.com")) == b"482913"
    assert redis.ttl_seconds[outbox_key("sam@example.com")] == 600
