"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Person } from "@/components/team/Person";
import { useUser } from "@/hooks/useUser";
import { useProjects } from "@/hooks/useProjects";
import { useTeam } from "@/hooks/useTeam";
import { firstErrorMessage } from "@/lib/errorMessage";
import { AddUserForm } from "./add/AddUserForm";
import { EditUserForm } from "./edit/EditUserForm";
import { MemberActions } from "./components/MemberActions";
import { ProjectMemberships } from "./components/ProjectMemberships";
import { RoleSelect } from "./components/RoleSelect";

// Below xl the full table doesn't fit beside the sidebar, so it turns into
// one stacked card per person (no sideways scrolling) and the column
// headings become small labels.
const stackedCell = "max-xl:block max-xl:p-0";
const mobileLabel =
  "mb-1 block text-xs font-medium tracking-wide text-muted-foreground uppercase xl:hidden";

export default function TeamPage() {
  const user = useUser();
  const isAdmin = user.data?.role === "admin";
  const team = useTeam({ enabled: isAdmin });
  const projects = useProjects();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Becomes undefined on its own if the person being edited is deleted.
  const editing = team.data?.find((m) => m.id === editingId);

  const error = firstErrorMessage([
    [team, "Failed to load the team"],
    [projects, "Failed to load projects"],
  ]);

  if (!user.data) return null;
  if (!isAdmin) {
    return <ErrorAlert message="Only admins can view the team." />;
  }
  const currentUserId = user.data.id;

  return (
    <>
      <PageHeader
        title="Team"
        actions={
          !adding && (
            <Button
              onClick={() => {
                setEditingId(null);
                setAdding(true);
              }}
            >
              <UserPlus /> Add user
            </Button>
          )
        }
      />
      {adding && <AddUserForm onDone={() => setAdding(false)} />}
      {editing && (
        <EditUserForm
          key={editing.id}
          member={editing}
          isYou={editing.id === currentUserId}
          onDone={() => setEditingId(null)}
        />
      )}
      <ErrorAlert message={error} />
      <Card className="mt-4">
        <CardContent>
          {team.data && team.data.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No one to show yet.
            </p>
          ) : (
            <Table className="max-xl:block">
              <TableHeader className="max-xl:hidden">
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="max-xl:block">
                {team.data?.map((member) => {
                  const isYou = member.id === currentUserId;
                  return (
                    <TableRow
                      key={member.id}
                      className="max-xl:flex max-xl:flex-col max-xl:gap-3 max-xl:py-4"
                    >
                      <TableCell className={stackedCell}>
                        <Person person={member} isYou={isYou} />
                      </TableCell>
                      <TableCell className={stackedCell}>
                        <span className={mobileLabel}>Role</span>
                        <RoleSelect member={member} isYou={isYou} />
                      </TableCell>
                      <TableCell className={stackedCell}>
                        <span className={mobileLabel}>Projects</span>
                        <ProjectMemberships
                          member={member}
                          projects={projects.data ?? []}
                        />
                      </TableCell>
                      <TableCell
                        className={`${stackedCell} xl:w-px xl:whitespace-nowrap`}
                      >
                        <MemberActions
                          member={member}
                          isYou={isYou}
                          onEdit={() => {
                            setAdding(false);
                            setEditingId(member.id);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
