import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.auth import UserRole


class MemberResponse(BaseModel):
    """A user as shown on a project's team list."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None
    role: str


class TeamMemberResponse(MemberResponse):
    """A user on the admin Team page, with the projects they belong to."""

    project_ids: list[int]


def _check_password_strength(v: str) -> str:
    if not any(c.isupper() for c in v):
        raise ValueError("Password must contain at least one uppercase letter")
    if not any(c.isdigit() for c in v):
        raise ValueError("Password must contain at least one digit")
    return v


class CreateTeamMemberRequest(BaseModel):
    """Admin creates an account. This is the only way accounts are created."""

    email: str
    password: str = Field(min_length=8)
    role: UserRole
    name: str | None = Field(default=None, max_length=200)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _check_password_strength(v)


class TeamMemberUpdateRequest(BaseModel):
    """Admin edits an account. Every field is optional; only those sent change.
    `password` resets the user's password (and signs them out everywhere)."""

    email: str | None = Field(default=None, min_length=3)
    name: str | None = Field(default=None, max_length=200)
    role: UserRole | None = None
    password: str | None = Field(default=None, min_length=8)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str | None) -> str | None:
        return None if v is None else _check_password_strength(v)


class AddMemberRequest(BaseModel):
    user_id: uuid.UUID
