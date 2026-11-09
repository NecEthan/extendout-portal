import type {
  DocumentUploadedResponse,
  DocumentVersion,
  PaginatedDocumentVersions,
  PaginatedDocuments,
  VersionUploadedResponse,
} from "@/interfaces";
import { api } from "./axiosClient";

export async function uploadDocument(
  file: File,
  title: string,
  projectId: number
): Promise<DocumentUploadedResponse> {
  // JSON.stringify can't represent file bytes, so the file would be lost. Which is why we are using a form here
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);
  form.append("project_id", String(projectId));

  const { data } = await api.post<DocumentUploadedResponse>("/documents", form);
  return data;
}

export async function listDocuments(
  limit: number,
  offset: number,
  projectId?: number
): Promise<PaginatedDocuments> {
  const { data } = await api.get<PaginatedDocuments>("/documents", {
    params: { limit, offset, project_id: projectId },
  });
  return data;
}

export async function uploadDocumentVersion(
  documentId: string,
  file: File
): Promise<VersionUploadedResponse> {
  const form = new FormData();
  form.append("file", file);

  const { data } = await api.post<VersionUploadedResponse>(
    `/documents/${documentId}/versions`,
    form
  );
  return data;
}

export async function listDocumentVersions(
  documentId: string,
  limit: number,
  offset: number
): Promise<PaginatedDocumentVersions> {
  const { data } = await api.get<PaginatedDocumentVersions>(
    `/documents/${documentId}/versions`,
    { params: { limit, offset } }
  );
  return data;
}

export async function activateDocumentVersion(
  documentId: string,
  versionId: string
): Promise<DocumentVersion> {
  const { data } = await api.patch<DocumentVersion>(
    `/documents/${documentId}/versions/${versionId}/activate`
  );
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/documents/${id}`);
}
