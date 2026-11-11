import type { NewProject, Project, ProjectUpdate } from "@/interfaces";
import { api } from "./axiosClient";

/** Projects the current user may access (admins: all; others: their memberships). */
export async function listProjects(): Promise<Project[]> {
  const { data } = await api.get<Project[]>("/projects");
  return data;
}

/** One project; rejects with ApiError 403 (not a member) or 404 (unknown). */
export async function getProject(id: number): Promise<Project> {
  const { data } = await api.get<Project>(
    `/projects/${encodeURIComponent(id)}`
  );
  return data;
}

/** Admin only. Returns the created project (id is assigned by the server). */
export async function createProject(body: NewProject): Promise<Project> {
  const { data } = await api.post<Project>("/projects", body);
  return data;
}

/** Admin only. Returns the updated project. */
export async function updateProject(
  id: number,
  changes: ProjectUpdate
): Promise<Project> {
  const { data } = await api.patch<Project>(`/projects/${id}`, changes);
  return data;
}

/** Admin only. Permanently deletes the project with its documents, photos and
 * memberships. */
export async function deleteProject(id: number): Promise<void> {
  await api.delete(`/projects/${encodeURIComponent(id)}`);
}
