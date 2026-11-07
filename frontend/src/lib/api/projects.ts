import type { ProjectSummary } from "@/interfaces";
import { httpClient } from "./client";

/** Projects the current user may access (admins: all; others: their memberships). */
export async function listProjects(): Promise<ProjectSummary[]> {
  return httpClient<ProjectSummary[]>("/projects");
}
