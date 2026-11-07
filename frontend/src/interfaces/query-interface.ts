import type { DocumentVersionStatus } from "./document-interface";

export interface QueryRequest {
  question: string;
  mode: "current" | "historical";
  project_id?: string;
}

export interface QueryCitation {
  document_title: string;
  version_number: number;
  status: DocumentVersionStatus;
  updated_at: string;
}

export interface QueryResponse {
  answer: string;
  citations: QueryCitation[];
}
