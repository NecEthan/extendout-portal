import { useQuery } from "@tanstack/react-query";
import { listProjects } from "@/lib/api/projects";
import { mockProjects } from "@/mocks/projects";

export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: listProjects });
}

/**
 * The portal's (mock) project details, limited to projects the backend says
 * the user may access. `data` is undefined while loading.
 */
export function useAccessibleProjects() {
  const projects = useProjects();
  const allowed = projects.data && new Set(projects.data.map((p) => p.id));
  return {
    ...projects,
    data: allowed && mockProjects.filter((p) => allowed.has(p.id)),
  };
}
