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

/** A document prepared by the backend for showing in the app
 * (`GET /documents/{id}/preview`). Only the field for `kind` is set. */
export interface DocumentPreview {
  kind: "pdf" | "docx" | "xlsx";
  /** PDF page sizes in points; images come from the pages endpoint. */
  pages: { width: number; height: number }[] | null;
  /** Word as HTML, already cleaned by the backend. */
  html: string | null;
  sheets: PreviewSheet[] | null;
}

export interface PreviewSheet {
  name: string;
  rows: { text: string; numeric: boolean }[][];
  /** The sheet goes past the rows/columns sent. */
  cut_rows: boolean;
  cut_columns: boolean;
}
