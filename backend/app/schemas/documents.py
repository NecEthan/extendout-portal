import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

# Longest document title accepted (upload and rename). Titles come from file
# names, which are at most 255 characters on most systems.
MAX_TITLE_LENGTH = 255


class DocumentVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID
    version_number: int
    status: str
    content_hash: str
    storage_key: str
    created_at: datetime
    created_by: uuid.UUID | None


class VersionUploadedResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    version_number: int
    status: str


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    owner_id: uuid.UUID | None
    source_type: str
    project_id: int | None = None
    created_at: datetime
    latest_version_status: str | None = None
    # True when a version can be downloaded (an older one may be ACTIVE while
    # a new upload is still processing).
    has_active_version: bool = False


class DocumentDetailResponse(DocumentResponse):
    versions: list[DocumentVersionResponse]


class PaginatedDocumentsResponse(BaseModel):
    items: list[DocumentResponse]
    total: int
    limit: int
    offset: int


class PaginatedDocumentVersionsResponse(BaseModel):
    items: list[DocumentVersionResponse]
    total: int
    limit: int
    offset: int


class DocumentUpdateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=MAX_TITLE_LENGTH)


class DocumentUploadedResponse(BaseModel):
    id: uuid.UUID
    status: str
