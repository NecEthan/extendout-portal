import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict


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


class RoleUpdateRequest(BaseModel):
    role: Literal["admin", "builder", "client"]


class AddMemberRequest(BaseModel):
    user_id: uuid.UUID
