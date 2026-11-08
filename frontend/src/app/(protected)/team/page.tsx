"use client";

import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorAlert } from "@/components/ui/error-alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/portal/PageHeader";
import { Person, RoleBadge, ROLES, roleLabel } from "@/components/team/Person";
import { useUser } from "@/hooks/useUser";
import { useProjects } from "@/hooks/useProjects";
import {
  useAddProjectMember,
  useRemoveProjectMember,
  useTeam,
  useUpdateRole,
} from "@/hooks/useTeam";
import { firstErrorMessage } from "@/lib/errorMessage";
import type { TeamMember, UserRole } from "@/interfaces";

const selectClass =
  "h-8 rounded-md border bg-background px-2 text-sm disabled:opacity-50";

export default function TeamPage() {
  const user = useUser();
  const isAdmin = user.data?.role === "admin";
  const team = useTeam({ enabled: isAdmin });
  const projects = useProjects();
  const updateRole = useUpdateRole();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();

  const projectName = (id: number) =>
    projects.data?.find((p) => p.id === id)?.name ?? id;

  const error = firstErrorMessage([
    [team, "Failed to load the team"],
    [projects, "Failed to load projects"],
    [updateRole, "Couldn't change the role"],
    [addMember, "Couldn't add them to the project"],
    [removeMember, "Couldn't remove them from the project"],
  ]);

  function renderProjects(member: TeamMember) {
    // Admins can access every project, so memberships don't apply to them.
    if (member.role === "admin") {
      return <Badge variant="neutral">All projects</Badge>;
    }
    const available = (projects.data ?? []).filter(
      (p) => !member.project_ids.includes(p.id)
    );
    return (
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
            className={selectClass}
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
    );
  }

  function renderRole(member: TeamMember) {
    const isYou = member.id === user.data?.id;
    if (isYou) return <RoleBadge role={member.role} />;
    return (
      <select
        aria-label={`Role for ${member.email}`}
        className={selectClass}
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
      </select>
    );
  }

  if (!user.data) return null;
  if (!isAdmin) {
    return <ErrorAlert message="Only admins can view the team." />;
  }

  return (
    <>
      <PageHeader
        title="Team"
        description="Everyone with an account. Change roles and choose which projects each person can access."
      />
      <ErrorAlert message={error} />
      <Card className="mt-4">
        <CardContent>
          {team.data && team.data.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No one to show yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Projects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.data?.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Person
                        person={member}
                        isYou={member.id === user.data?.id}
                      />
                    </TableCell>
                    <TableCell>{renderRole(member)}</TableCell>
                    <TableCell>{renderProjects(member)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
