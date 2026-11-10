"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Person, RoleBadge } from "@/components/team/Person";
import { useUser } from "@/hooks/useUser";
import { useProjectMembers } from "@/hooks/useTeam";
import { getErrorMessage } from "@/lib/errorMessage";

/** Admin only: the people who can access one project (read-only; access is
 * managed on the Team page). */
export function TeamTab({ projectId }: { projectId: number }) {
  const user = useUser();
  const members = useProjectMembers(projectId);

  const error = getErrorMessage(members, "Failed to load project members");

  return (
    <div className="flex flex-col gap-4">
      <ErrorAlert message={error} />

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
            <RoleBadge role={m.role} />
          </Card>
        ))}
      </div>
    </div>
  );
}
