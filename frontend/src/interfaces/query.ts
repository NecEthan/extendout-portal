import type { DocumentVersionStatus } from "./document";

export interface QueryRequest {
  question: string;
  mode: "current" | "historical";
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
