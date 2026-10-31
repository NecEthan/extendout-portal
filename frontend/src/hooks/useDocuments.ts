import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteDocument, listDocuments, uploadDocument } from "@/lib/api/documents";

export function useDocuments(limit: number, offset: number) {
  return useQuery({
    queryKey: ["documents", limit, offset],
    queryFn: () => listDocuments(limit, offset),
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      title,
      sensitivity,
    }: {
      file: File;
      title: string;
      sensitivity: string;
    }) => uploadDocument(file, title, sensitivity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
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
