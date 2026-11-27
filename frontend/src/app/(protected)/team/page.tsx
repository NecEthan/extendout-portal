"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { PageHeader } from "@/components/portal/PageHeader";
import { Person, RoleBadge } from "@/components/team/Person";
import { useUser } from "@/hooks/useUser";
import { useProjects } from "@/hooks/useProjects";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTeam } from "@/hooks/useTeam";
import type { TeamRoleFilter } from "@/interfaces";
import { firstErrorMessage } from "@/lib/errorMessage";
import { AddUserForm } from "./add/AddUserForm";
import { EditUserForm } from "./edit/EditUserForm";
import { MemberActions } from "./components/MemberActions";
import { ProjectList } from "./components/ProjectList";
import { TeamFilters } from "./components/TeamFilters";

// Rows are read-only (changes happen in the Edit panel, which opens under the
// row). One line per person on wide screens. Narrower, two lines: the person
// and the Edit/Delete buttons, then role and projects side by side.
const columns =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 lg:grid-cols-[minmax(0,16rem)_6rem_minmax(0,1fr)_auto]";
const heading =
  "text-xs font-medium tracking-wide text-muted-foreground uppercase";

export default function TeamPage() {
  const user = useUser();
  const isAdmin = user.data?.role === "admin";
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<TeamRoleFilter>("all");
  const team = useTeam({
    search: useDebouncedValue(search),
    role,
    enabled: isAdmin,
  });
  const projects = useProjects();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const error = firstErrorMessage([
    [team, "Failed to load the team"],
    [projects, "Failed to load projects"],
  ]);

  if (!user.data) return null;
  if (!isAdmin) {
    return <ErrorAlert message="Only admins can view the team." />;
  }
  const currentUserId = user.data.id;
  const shown = team.data?.members ?? [];
  const filtered = search.trim() !== "" || role !== "all";

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
      <ErrorAlert message={error} />
      <Card className="mt-4">
        <CardContent>
          {team.data && team.data.counts.all === 0 && !filtered ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No one to show yet.
            </p>
          ) : (
            <>
              <TeamFilters
                search={search}
                onSearch={setSearch}
                role={role}
                onRole={setRole}
                counts={team.data?.counts}
              />
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
                {shown.map((member) => {
                  const isYou = member.id === currentUserId;
                  const isEditing = member.id === editingId;
                  return (
                    <li key={member.id} className={`${columns} py-3`}>
                      <Person person={member} isYou={isYou} />
                      <div className="justify-self-end lg:col-start-4 lg:row-start-1">
                        <MemberActions
                          member={member}
                          isYou={isYou}
                          isEditing={isEditing}
                          onEdit={() => {
                            setAdding(false);
                            setEditingId(isEditing ? null : member.id);
                          }}
                        />
                      </div>
                      <div className="col-span-2 flex min-w-0 items-center gap-3 lg:contents">
                        <div className="shrink-0 lg:col-start-2 lg:row-start-1">
                          <RoleBadge role={member.role} />
                        </div>
                        <div className="min-w-0 lg:col-start-3 lg:row-start-1">
                          <ProjectList
                            member={member}
                            projects={projects.data ?? []}
                          />
                        </div>
                      </div>
                      {isEditing && (
                        <div className="col-span-full">
                          <EditUserForm
                            member={member}
                            isYou={isYou}
                            projects={projects.data ?? []}
                            onDone={() => setEditingId(null)}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {team.data && shown.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                  <p>No one matches.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setRole("all");
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
