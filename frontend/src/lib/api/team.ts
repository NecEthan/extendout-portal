import type {
  Member,
  NewUser,
  TeamList,
  TeamMember,
  TeamMemberUpdate,
  TeamRoleFilter,
} from "@/interfaces";
import { apiRoutes } from "./apiRoutes";
import { api } from "./axiosClient";

/** All team endpoints are admin only. The backend searches, filters and
 * sorts. */
export async function listTeam({
  search,
  role,
}: {
  search: string;
  role: TeamRoleFilter;
}): Promise<TeamList> {
  const { data } = await api.get<TeamList>(apiRoutes.team.list, {
    params: { search: search.trim() || undefined, role },
  });
  return data;
}

export async function createUser(body: NewUser): Promise<TeamMember> {
  const { data } = await api.post<TeamMember>(apiRoutes.team.list, body);
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
