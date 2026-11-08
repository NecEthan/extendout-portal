import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserRole } from "@/interfaces";
import {
  addProjectMember,
  listProjectMembers,
  listTeam,
  removeProjectMember,
  updateRole,
} from "@/lib/api/team";

export function useTeam({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: ["team"], queryFn: listTeam, enabled });
}

export function useProjectMembers(projectId: number) {
  return useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => listProjectMembers(projectId),
  });
}

/** Membership and role changes affect the team list, project member lists and
 * which projects people can see — refresh all of them. */
function useInvalidateTeam() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["team"] });
    queryClient.invalidateQueries({ queryKey: ["project-members"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
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
