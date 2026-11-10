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
    # Whether the *current* user may delete it, so the UI only shows the
    # delete button where the API will allow it (rule: can_delete_photo).
    can_delete: bool
