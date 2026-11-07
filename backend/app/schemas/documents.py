import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


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
    project_id: str | None = None
    created_at: datetime
    latest_version_status: str | None = None


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
    title: str


class DocumentUploadedResponse(BaseModel):
    id: uuid.UUID
    status: str
