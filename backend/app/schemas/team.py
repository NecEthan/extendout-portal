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


class CreateTeamMemberRequest(BaseModel):
    """Admin creates an account. This is the only way accounts are created."""

    email: str
    password: str = Field(min_length=8)
    role: UserRole
    name: str | None = Field(default=None, max_length=200)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class RoleUpdateRequest(BaseModel):
    role: UserRole


class AddMemberRequest(BaseModel):
    user_id: uuid.UUID
