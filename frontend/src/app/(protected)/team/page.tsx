"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
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

// One line per person on wide screens. Narrower, two lines: the person and
// the Edit/Delete buttons, then role and projects side by side.
const columns =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 lg:grid-cols-[minmax(0,15rem)_7rem_minmax(0,1fr)_auto]";
const heading =
  "text-xs font-medium tracking-wide text-muted-foreground uppercase";

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
            <>
              <div
                aria-hidden
                className={`${columns} border-b pb-2 max-lg:hidden`}
              >
                <span className={heading}>Person</span>
                <span className={heading}>Role</span>
                <span className={heading}>Projects</span>
                <span className={`${heading} text-right`}>Actions</span>
              </div>
              <ul aria-label="Team" className="divide-y">
                {team.data?.map((member) => {
                  const isYou = member.id === currentUserId;
                  return (
                    <li key={member.id} className={`${columns} py-3`}>
                      <Person person={member} isYou={isYou} />
                      <div className="justify-self-end lg:col-start-4 lg:row-start-1">
                        <MemberActions
                          member={member}
                          isYou={isYou}
                          onEdit={() => {
                            setAdding(false);
                            setEditingId(member.id);
                          }}
                        />
                      </div>
                      <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-1.5 lg:contents">
                        <div className="max-lg:contents lg:col-start-2 lg:row-start-1">
                          <RoleSelect member={member} isYou={isYou} />
                        </div>
                        <div className="min-w-0 max-lg:contents lg:col-start-3 lg:row-start-1">
                          <ProjectMemberships
                            member={member}
                            projects={projects.data ?? []}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
