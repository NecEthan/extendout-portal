from pydantic import BaseModel, ConfigDict


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
