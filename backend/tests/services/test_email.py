"""send_login_code: EmailJS payload, failures, and the outbox backend."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.config import settings
from app.services.email import (
    EMAILJS_SEND_URL,
    EmailSendError,
    outbox_key,
    send_login_code,
)
from tests.fixtures.arq import FakeRedis


@pytest.fixture
def emailjs(monkeypatch):
    monkeypatch.setattr(settings, "email_backend", "emailjs")
    monkeypatch.setattr(settings, "emailjs_service_id", "service_x")
    monkeypatch.setattr(settings, "emailjs_template_id", "template_y")
    monkeypatch.setattr(settings, "emailjs_public_key", "public_k")
    monkeypatch.setattr(settings, "emailjs_private_key", "private_k")


def _client_returning(response):
    client = MagicMock()
    client.post = AsyncMock(return_value=response)
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=client)
    context.__aexit__ = AsyncMock(return_value=False)
    return client, context


async def test_emailjs_payload(emailjs):
    client, context = _client_returning(httpx.Response(200, text="OK"))
    with patch("app.services.email.httpx.AsyncClient", return_value=context):
        await send_login_code(FakeRedis(), "sam@example.com", "Sam", "482913")

    client.post.assert_awaited_once_with(
        EMAILJS_SEND_URL,
        json={
            "service_id": "service_x",
            "template_id": "template_y",
            "user_id": "public_k",
            "accessToken": "private_k",
            "template_params": {
                "to_email": "sam@example.com",
                "to_name": "Sam",
                "code": "482913",
                "expires_minutes": 10,
            },
        },
    )


async def test_emailjs_uses_email_when_no_name(emailjs):
    client, context = _client_returning(httpx.Response(200, text="OK"))
    with patch("app.services.email.httpx.AsyncClient", return_value=context):
        await send_login_code(FakeRedis(), "sam@example.com", None, "482913")
    params = client.post.await_args.kwargs["json"]["template_params"]
    assert params["to_name"] == "sam@example.com"


async def test_emailjs_rejection_raises(emailjs):
    _, context = _client_returning(httpx.Response(400, text="bad template"))
    with patch("app.services.email.httpx.AsyncClient", return_value=context):
        with pytest.raises(EmailSendError):
            await send_login_code(FakeRedis(), "sam@example.com", "Sam", "482913")


async def test_emailjs_network_error_raises(emailjs):
    client, context = _client_returning(None)
    client.post = AsyncMock(side_effect=httpx.ConnectError("down"))
    with patch("app.services.email.httpx.AsyncClient", return_value=context):
        with pytest.raises(EmailSendError):
            await send_login_code(FakeRedis(), "sam@example.com", "Sam", "482913")


async def test_outbox_stores_the_code_and_sends_nothing(monkeypatch):
    monkeypatch.setattr(settings, "email_backend", "outbox")
    redis = FakeRedis()
    with patch("app.services.email.httpx.AsyncClient") as client_cls:
        await send_login_code(redis, "sam@example.com", "Sam", "482913")
    client_cls.assert_not_called()
    assert await redis.get(outbox_key("sam@example.com")) == b"482913"
    assert redis.ttl_seconds[outbox_key("sam@example.com")] == 600
