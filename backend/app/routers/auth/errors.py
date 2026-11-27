"""Errors shared by the login endpoints."""

from fastapi import HTTPException


def too_many(message: str, retry_after_seconds: int) -> HTTPException:
    """A 429 with the wait in the message and in ``Retry-After``."""
    return HTTPException(
        status_code=429,
        detail=message,
        headers={"Retry-After": str(retry_after_seconds)},
    )
