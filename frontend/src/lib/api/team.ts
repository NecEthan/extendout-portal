import type {
  Member,
  NewUser,
  TeamMember,
  TeamMemberUpdate,
  UserRole,
} from "@/interfaces";
import { apiRoutes } from "./apiRoutes";
import { api } from "./axiosClient";

/** All team endpoints are admin only. */
export async function listTeam(): Promise<TeamMember[]> {
  const { data } = await api.get<TeamMember[]>(apiRoutes.team.list);
  return data;
}

export async function createUser(body: NewUser): Promise<TeamMember> {
  const { data } = await api.post<TeamMember>(apiRoutes.team.list, body);
  return data;
}

export async function updateRole(
  userId: string,
  role: UserRole
): Promise<TeamMember> {
  const { data } = await api.patch<TeamMember>(apiRoutes.team.member(userId), {
    role,
  });
  return data;
}

export async function updateTeamMember(
  userId: string,
  body: TeamMemberUpdate
): Promise<TeamMember> {
  const { data } = await api.patch<TeamMember>(
    apiRoutes.team.member(userId),
    body
  );
  return data;
}

export async function deleteTeamMember(userId: string): Promise<void> {
  await api.delete(apiRoutes.team.member(userId));
}

export async function listProjectMembers(projectId: number): Promise<Member[]> {
  const { data } = await api.get<Member[]>(
    apiRoutes.projects.members(projectId)
  );
  return data;
}

export async function addProjectMember(
  projectId: number,
  userId: string
): Promise<Member> {
  const { data } = await api.post<Member>(
    apiRoutes.projects.members(projectId),
    {
      user_id: userId,
    }
  );
  return data;
}

export async function removeProjectMember(
  projectId: number,
  userId: string
): Promise<void> {
  await api.delete(apiRoutes.projects.member(projectId, userId));
}
