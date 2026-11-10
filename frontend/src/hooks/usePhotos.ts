import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteProjectPhoto,
  listProjectPhotos,
  uploadProjectPhoto,
} from "@/lib/api/photos";

export function useProjectPhotos(projectId: number) {
  return useQuery({
    queryKey: ["photos", projectId],
    queryFn: () => listProjectPhotos(projectId),
  });
}

export function useUploadPhoto(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, description }: { file: File; description?: string }) =>
      uploadProjectPhoto(projectId, file, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photos", projectId] });
    },
  });
}

export function useDeletePhoto(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => deleteProjectPhoto(projectId, photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photos", projectId] });
    },
  });
}
