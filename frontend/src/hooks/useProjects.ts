import { useQuery } from "@tanstack/react-query";
import { getProject, listProjects } from "@/lib/api/projects";

export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: listProjects });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => getProject(id),
  });
}
