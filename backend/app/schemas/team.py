import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.auth import UserRole, normalise_email


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


class CreateTeamMemberRequest(BaseModel):
    """Admin creates an account. This is the only way accounts are created.
    People log in with a code emailed to them, so there's no password."""

    email: str = Field(min_length=3, max_length=320)
    role: UserRole
    name: str | None = Field(default=None, max_length=200)

    @field_validator("email")
    @classmethod
    def _normalise(cls, v: str) -> str:
        return normalise_email(v)


class TeamMemberUpdateRequest(BaseModel):
    """Admin edits an account. Every field is optional; only those sent change."""

    email: str | None = Field(default=None, min_length=3, max_length=320)
    name: str | None = Field(default=None, max_length=200)
    role: UserRole | None = None

    @field_validator("email")
    @classmethod
    def _normalise(cls, v: str | None) -> str | None:
        return None if v is None else normalise_email(v)


class AddMemberRequest(BaseModel):
    user_id: uuid.UUID
