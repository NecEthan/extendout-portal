export type DocumentSourceType = "upload" | "google_docs";

export type DocumentVersionStatus =
  | "PROCESSING"
  | "ACTIVE"
  | "SUPERSEDED"
  | "DELETED"
  | "REVIEW_REQUIRED"
  | "FAILED";

export interface Document {
  id: string;
  title: string;
  owner_id: string;
  source_type: DocumentSourceType;
  project_id: number | null;
  created_at: string;
  latest_version_status: DocumentVersionStatus | null;
  has_active_version: boolean;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  status: DocumentVersionStatus;
  content_hash: string;
  storage_key: string;
  created_at: string;
  created_by: string;
}

export type ProcessingJobStatus =
  "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED";

export interface DocumentUploadedResponse {
  id: string;
  status: string;
}

export interface VersionUploadedResponse {
  id: string;
  document_id: string;
  version_number: number;
  status: string;
}

export interface PaginatedDocuments {
  items: Document[];
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedDocumentVersions {
  items: DocumentVersion[];
  total: number;
  limit: number;
  offset: number;
}
