export type DocumentSourceType = "upload" | "google_docs";

export type DocumentSensitivity = "STANDARD" | "SENSITIVE";

export interface Document {
  id: string;
  title: string;
  owner_id: string;
  source_type: DocumentSourceType;
  sensitivity: DocumentSensitivity;
  created_at: string;
}

export type DocumentVersionStatus =
  | "PROCESSING"
  | "ACTIVE"
  | "SUPERSEDED"
  | "DELETED"
  | "REVIEW_REQUIRED"
  | "FAILED";

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

export type ProcessingJobStatus = "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED";

export interface DocumentDetail extends Document {
  versions: DocumentVersion[];
}

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
