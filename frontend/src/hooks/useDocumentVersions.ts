import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateDocumentVersion,
  listDocumentVersions,
  uploadDocumentVersion,
} from "@/lib/api/documents";

export function useDocumentVersions(documentId: string) {
  return useQuery({
    queryKey: ["documentVersions", documentId],
    queryFn: () => listDocumentVersions(documentId),
  });
}

export function useUploadDocumentVersion(documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadDocumentVersion(documentId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentVersions", documentId] });
    },
  });
}

export function useActivateDocumentVersion(documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => activateDocumentVersion(documentId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentVersions", documentId] });
    },
  });
}
