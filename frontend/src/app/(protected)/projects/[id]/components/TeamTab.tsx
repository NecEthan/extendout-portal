"use client";

import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Person, RoleBadge, displayName } from "@/components/team/Person";
import { useUser } from "@/hooks/useUser";
import {
  useAddProjectMember,
  useProjectMembers,
  useRemoveProjectMember,
  useTeam,
} from "@/hooks/useTeam";
import { firstErrorMessage } from "@/lib/errorMessage";

/** Admin only: the people who can access one project, with add and remove. */
export function TeamTab({ projectId }: { projectId: number }) {
  const user = useUser();
  const members = useProjectMembers(projectId);
  const team = useTeam();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();

  const error = firstErrorMessage([
    [members, "Failed to load project members"],
    [addMember, "Couldn't add them to the project"],
    [removeMember, "Couldn't remove them from the project"],
  ]);

  const memberIds = new Set(members.data?.map((m) => m.id));
  // Admins already see every project, so there's no point adding them.
  const addable = (team.data ?? []).filter(
    (t) => t.role !== "admin" && !memberIds.has(t.id)
  );

  return (
    <div className="flex flex-col gap-4">
      <ErrorAlert message={error} />

      {addable.length > 0 && (
        <div className="flex justify-end">
          <select
            aria-label="Add a person to this project"
            className="h-9 rounded-md border bg-background px-2 text-sm disabled:opacity-50"
            value=""
            disabled={addMember.isPending}
            onChange={(e) =>
              e.target.value &&
              addMember.mutate({ projectId, userId: e.target.value })
            }
          >
            <option value="">+ Add person</option>
            {addable.map((t) => (
              <option key={t.id} value={t.id}>
                {displayName(t)} ({t.role})
              </option>
            ))}
          </select>
        </div>
      )}

      {members.data?.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No one has been added to this project yet.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {members.data?.map((m) => (
          <Card
            key={m.id}
            className="flex-row items-center justify-between gap-3 px-4"
          >
            <Person person={m} isYou={m.id === user.data?.id} />
            <div className="flex shrink-0 items-center gap-2">
              <RoleBadge role={m.role} />
              <button
                type="button"
                aria-label={`Remove ${displayName(m)} from this project`}
                className="rounded-sm text-muted-foreground hover:text-destructive disabled:opacity-50"
                disabled={removeMember.isPending}
                onClick={() => removeMember.mutate({ projectId, userId: m.id })}
              >
                <X size={16} />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
