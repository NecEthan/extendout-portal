from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    client: str
    address: str


class _StripText(BaseModel):
    """Trims whitespace from text fields before validation."""

    @field_validator("name", "client", "address", mode="before", check_fields=False)
    @classmethod
    def strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ProjectCreateRequest(_StripText):
    name: str = Field(min_length=1, max_length=200)
    client: str = Field(default="", max_length=200)
    address: str = Field(default="", max_length=500)


class ProjectUpdateRequest(_StripText):
    """Partial update: only the fields sent are changed."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    client: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=500)
