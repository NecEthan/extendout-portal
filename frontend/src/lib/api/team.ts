import type { Member, TeamMember, UserRole } from "@/interfaces";
import { httpClient, throwIfError } from "./client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** All team endpoints are admin only. */
export async function listTeam(): Promise<TeamMember[]> {
  return httpClient<TeamMember[]>("/team");
}

export async function updateRole(
  userId: string,
  role: UserRole
): Promise<TeamMember> {
  return httpClient<TeamMember>(`/team/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function listProjectMembers(projectId: number): Promise<Member[]> {
  return httpClient<Member[]>(
    `/projects/${encodeURIComponent(projectId)}/members`
  );
}

export async function addProjectMember(
  projectId: number,
  userId: string
): Promise<Member> {
  return httpClient<Member>(
    `/projects/${encodeURIComponent(projectId)}/members`,
    { method: "POST", body: JSON.stringify({ user_id: userId }) }
  );
}

export async function removeProjectMember(
  projectId: number,
  userId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/members/${userId}`,
    { method: "DELETE", credentials: "include" }
  );
  await throwIfError(res);
}
