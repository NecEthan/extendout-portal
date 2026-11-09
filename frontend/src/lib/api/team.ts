import type { Member, NewUser, TeamMember, UserRole } from "@/interfaces";
import { api } from "./client";

/** All team endpoints are admin only. */
export async function listTeam(): Promise<TeamMember[]> {
  const { data } = await api.get<TeamMember[]>("/team");
  return data;
}

export async function createUser(body: NewUser): Promise<TeamMember> {
  const { data } = await api.post<TeamMember>("/team", body);
  return data;
}

export async function updateRole(
  userId: string,
  role: UserRole
): Promise<TeamMember> {
  const { data } = await api.patch<TeamMember>(`/team/${userId}`, { role });
  return data;
}

export async function listProjectMembers(projectId: number): Promise<Member[]> {
  const { data } = await api.get<Member[]>(
    `/projects/${encodeURIComponent(projectId)}/members`
  );
  return data;
}

export async function addProjectMember(
  projectId: number,
  userId: string
): Promise<Member> {
  const { data } = await api.post<Member>(
    `/projects/${encodeURIComponent(projectId)}/members`,
    { user_id: userId }
  );
  return data;
}

export async function removeProjectMember(
  projectId: number,
  userId: string
): Promise<void> {
  await api.delete(
    `/projects/${encodeURIComponent(projectId)}/members/${userId}`
  );
}
