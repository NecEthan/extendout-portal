import type {
  DocumentUploadedResponse,
  DocumentVersion,
  PaginatedDocumentVersions,
  PaginatedDocuments,
  VersionUploadedResponse,
} from "@/interfaces";
import { apiRoutes } from "./apiRoutes";
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

  const { data } = await api.post<DocumentUploadedResponse>(
    apiRoutes.documents,
    form
  );
  return data;
}

export async function listDocuments(
  limit: number,
  offset: number,
  projectId?: number
): Promise<PaginatedDocuments> {
  const { data } = await api.get<PaginatedDocuments>(apiRoutes.documents, {
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
    apiRoutes.documentVersions(documentId),
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
    apiRoutes.documentVersions(documentId),
    { params: { limit, offset } }
  );
  return data;
}

export async function activateDocumentVersion(
  documentId: string,
  versionId: string
): Promise<DocumentVersion> {
  const { data } = await api.patch<DocumentVersion>(
    apiRoutes.activateDocumentVersion(documentId, versionId)
  );
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(apiRoutes.document(id));
}

/** URL that downloads the document's current (ACTIVE) file. Used as a plain
 * link: the browser sends the session cookie, the backend checks access and
 * answers with `Content-Disposition: attachment`, so the file is saved rather
 * than opened in the app. */
export function documentDownloadUrl(documentId: string): string {
  return `${api.defaults.baseURL}${apiRoutes.documentDownload(documentId)}`;
}
