import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NewProject, ProjectUpdate } from "@/interfaces";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "@/lib/api/projects";

export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: listProjects });
}

export function useProject(id: number) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => getProject(id),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewProject) => createProject(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: ProjectUpdate) => updateProject(id, changes),
    // ["projects"] also covers this project's ["projects", id] query.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteProject(id),
    onSuccess: () => {
      // Drop the deleted project's cached data rather than refetching it (404).
      for (const key of [
        "projects",
        "documents",
        "photos",
        "project-members",
      ]) {
        queryClient.removeQueries({ queryKey: [key, id] });
      }
      // Members' project_ids changed too.
      queryClient.invalidateQueries({ queryKey: ["team"] });
      return queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
