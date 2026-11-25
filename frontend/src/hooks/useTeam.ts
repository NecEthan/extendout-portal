import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  NewUser,
  TeamMemberUpdate,
  TeamRoleFilter,
  UserRole,
} from "@/interfaces";
import {
  addProjectMember,
  createUser,
  deleteTeamMember,
  listProjectMembers,
  listTeam,
  removeProjectMember,
  updateRole,
  updateTeamMember,
} from "@/lib/api/team";

/** The Team page list. Keeps showing the last results while a new search
 * loads, so the list doesn't flash empty. */
export function useTeam({
  search,
  role,
  enabled = true,
}: {
  search: string;
  role: TeamRoleFilter;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["team", { search, role }],
    queryFn: () => listTeam({ search, role }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useProjectMembers(projectId: number) {
  return useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => listProjectMembers(projectId),
  });
}

/** Membership, role and account changes affect the team list, project member lists and
 * which projects people can see — refresh all of them. */
function useInvalidateTeam() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["team"] });
    queryClient.invalidateQueries({ queryKey: ["project-members"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    // An admin may have edited their own name or email.
    queryClient.invalidateQueries({ queryKey: ["user"] });
  };
}

export function useUpdateRole() {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      updateRole(userId, role),
    onSuccess: invalidate,
  });
}

export function useAddProjectMember() {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: ({
      projectId,
      userId,
    }: {
      projectId: number;
      userId: string;
    }) => addProjectMember(projectId, userId),
    onSuccess: invalidate,
  });
}

export function useRemoveProjectMember() {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: ({
      projectId,
      userId,
    }: {
      projectId: number;
      userId: string;
    }) => removeProjectMember(projectId, userId),
    onSuccess: invalidate,
  });
}

export function useCreateUser() {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: (body: NewUser) => createUser(body),
    onSuccess: invalidate,
  });
}

export function useUpdateTeamMember() {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: ({
      userId,
      body,
    }: {
      userId: string;
      body: TeamMemberUpdate;
    }) => updateTeamMember(userId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteTeamMember() {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: (userId: string) => deleteTeamMember(userId),
    onSuccess: invalidate,
  });
}
