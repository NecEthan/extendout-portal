"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAddProjectMember, useRemoveProjectMember } from "@/hooks/useTeam";
import type { Project, TeamMember } from "@/interfaces";
import { RowError } from "./RowError";
import { rowSelectClass } from "./styles";

/** The projects someone belongs to, with remove (×) and add-to-project. */
export function ProjectMemberships({
  member,
  projects,
}: {
  member: TeamMember;
  projects: Project[];
}) {
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();

  // Admins can access every project, so memberships don't apply to them.
  if (member.role === "admin") {
    return <Badge variant="neutral">All projects</Badge>;
  }

  const projectName = (id: number) =>
    projects.find((p) => p.id === id)?.name ?? id;
  const available = projects.filter((p) => !member.project_ids.includes(p.id));

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {member.project_ids.map((projectId) => (
          <Badge key={projectId} variant="outline" className="gap-1">
            {projectName(projectId)}
            <button
              type="button"
              aria-label={`Remove from ${projectName(projectId)}`}
              className="rounded-sm hover:text-destructive disabled:opacity-50"
              disabled={removeMember.isPending}
              onClick={() =>
                removeMember.mutate({ projectId, userId: member.id })
              }
            >
              <X size={12} />
            </button>
          </Badge>
        ))}
        {available.length > 0 && (
          <select
            aria-label={`Add ${member.email} to a project`}
            className={rowSelectClass}
            value=""
            disabled={addMember.isPending}
            onChange={(e) =>
              e.target.value &&
              addMember.mutate({
                projectId: Number(e.target.value),
                userId: member.id,
              })
            }
          >
            <option value="">+ Add to project</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <RowError
        source={addMember}
        fallback="Couldn't add them to the project"
      />
      <RowError
        source={removeMember}
        fallback="Couldn't remove them from the project"
      />
    </>
  );
}
