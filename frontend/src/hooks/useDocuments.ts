import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteDocument,
  getDocumentPreview,
  listDocuments,
  uploadDocument,
} from "@/lib/api/documents";
import { isProcessing } from "@/utils/documentStatus";

export function useDocuments(projectId: number, limit: number, offset: number) {
  return useQuery({
    queryKey: ["documents", projectId, limit, offset],
    queryFn: () => listDocuments(limit, offset, projectId),
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.items.some((d) =>
        isProcessing(d.latest_version_status)
      );
      return hasProcessing ? 3000 : false;
    },
  });
}

export function useUploadDocument(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, title }: { file: File; title: string }) =>
      uploadDocument(file, title, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", projectId] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** The document prepared for the preview pop-up. Not kept once the pop-up
 * closes (gcTime 0): documents may be replaced, deleted or access revoked. */
export function useDocumentPreview(id: string) {
  return useQuery({
    queryKey: ["document-preview", id],
    queryFn: () => getDocumentPreview(id),
    gcTime: 0,
    retry: false,
  });
}
