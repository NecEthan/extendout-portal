"use client";

import { RoleBadge, ROLES, roleLabel } from "@/components/team/Person";
import { useUpdateRole } from "@/hooks/useTeam";
import type { TeamMember, UserRole } from "@/interfaces";
import { RowError } from "./RowError";
import { rowSelectClass } from "./styles";
import { NativeSelect } from "@/components/ui/native-select";

/** Change someone's role inline. Admins can't change their own. */
export function RoleSelect({
  member,
  isYou,
}: {
  member: TeamMember;
  isYou: boolean;
}) {
  const updateRole = useUpdateRole();
  if (isYou) return <RoleBadge role={member.role} />;
  return (
    <>
      <NativeSelect
        aria-label={`Role for ${member.email}`}
        className={`${rowSelectClass} w-28`}
        value={member.role}
        disabled={updateRole.isPending}
        onChange={(e) =>
          updateRole.mutate({
            userId: member.id,
            role: e.target.value as UserRole,
          })
        }
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {roleLabel(role)}
          </option>
        ))}
      </NativeSelect>
      <RowError source={updateRole} fallback="Couldn't change the role" />
    </>
  );
}
