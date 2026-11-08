from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    client: str
    address: str
    health: str


class ProjectCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    client: str = Field(default="", max_length=200)
    address: str = Field(default="", max_length=500)

    @field_validator("name", "client", "address", mode="before")
    @classmethod
    def strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value
