import uuid
from datetime import datetime

from pydantic import BaseModel

MAX_DESCRIPTION_LENGTH = 500


class PhotoResponse(BaseModel):
    id: uuid.UUID
    project_id: int
    description: str | None
    content_type: str
    uploaded_by_name: str | None  # name, or email if no name; None if deleted
    created_at: datetime
