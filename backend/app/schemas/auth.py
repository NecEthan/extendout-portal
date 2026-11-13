import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

UserRole = Literal["admin", "builder", "client"]


def normalise_email(email: str) -> str:
    """Emails are matched and stored lowercase, without surrounding spaces."""
    return email.strip().lower()


class RequestCodeRequest(BaseModel):
    """Ask for a login code to be emailed."""

    email: str = Field(min_length=3, max_length=320)

    @field_validator("email")
    @classmethod
    def _normalise(cls, v: str) -> str:
        return normalise_email(v)


class VerifyCodeRequest(RequestCodeRequest):
    """Log in with the emailed code."""

    code: str = Field(pattern=r"^\d{6}$")


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None = None
    role: str
    created_at: datetime
