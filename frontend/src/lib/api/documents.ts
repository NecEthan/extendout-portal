import type {
  DocumentUploadedResponse,
  DocumentVersion,
  PaginatedDocumentVersions,
  PaginatedDocuments,
  VersionUploadedResponse,
} from "@/interfaces";
import { httpClient, throwIfError } from "./client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function uploadDocument(
  file: File,
  title: string,
  sensitivity: string,
): Promise<DocumentUploadedResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);
  form.append("sensitivity", sensitivity);

  const res = await fetch(`${API_BASE_URL}/documents`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  await throwIfError(res);

  return res.json();
}

export async function listDocuments(
  limit: number,
  offset: number,
): Promise<PaginatedDocuments> {
  return httpClient<PaginatedDocuments>(`/documents?limit=${limit}&offset=${offset}`);
}

export async function uploadDocumentVersion(
  documentId: string,
  file: File,
): Promise<VersionUploadedResponse> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE_URL}/documents/${documentId}/versions`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  await throwIfError(res);

  return res.json();
}

export async function listDocumentVersions(
  documentId: string,
  limit: number,
  offset: number,
): Promise<PaginatedDocumentVersions> {
  return httpClient<PaginatedDocumentVersions>(
    `/documents/${documentId}/versions?limit=${limit}&offset=${offset}`,
  );
}

export async function activateDocumentVersion(
  documentId: string,
  versionId: string,
): Promise<DocumentVersion> {
  return httpClient<DocumentVersion>(
    `/documents/${documentId}/versions/${versionId}/activate`,
    { method: "PATCH" },
  );
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/documents/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  await throwIfError(res);
}
