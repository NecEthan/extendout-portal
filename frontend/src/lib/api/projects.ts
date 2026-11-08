import type { NewProject, Project } from "@/interfaces";
import { httpClient } from "./client";

/** Projects the current user may access (admins: all; others: their memberships). */
export async function listProjects(): Promise<Project[]> {
  return httpClient<Project[]>("/projects");
}

/** One project; rejects with ApiError 403 (not a member) or 404 (unknown). */
export async function getProject(id: number): Promise<Project> {
  return httpClient<Project>(`/projects/${encodeURIComponent(id)}`);
}

/** Admin only. Returns the created project (id is assigned by the server). */
export async function createProject(body: NewProject): Promise<Project> {
  return httpClient<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
