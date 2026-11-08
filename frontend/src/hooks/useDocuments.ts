import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteDocument,
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
