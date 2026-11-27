"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { displayName, ROLES, roleLabel } from "@/components/team/Person";
import { useUpdateTeamMember } from "@/hooks/useTeam";
import { getErrorMessage } from "@/lib/errorMessage";
import { INPUT_LIMITS } from "@/lib/inputLimits";
import type {
  Project,
  TeamMember,
  TeamMemberUpdate,
  UserRole,
} from "@/interfaces";
import { NativeSelect } from "@/components/ui/native-select";
import { ProjectMemberships } from "../components/ProjectMemberships";

/** Admin only: the panel under a Team row to edit someone's name, email and
 * role (saved together), and their projects (each change saves straight away).
 * Admins can't change their own role (the backend refuses it too). */
export function EditUserForm({
  member,
  isYou,
  projects,
  onDone,
}: {
  member: TeamMember;
  isYou: boolean;
  projects: Project[];
  onDone: () => void;
}) {
  const updateMember = useUpdateTeamMember();
  const [name, setName] = useState(member.name ?? "");
  const [email, setEmail] = useState(member.email);
  const [role, setRole] = useState<UserRole>(member.role);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const body: TeamMemberUpdate = {};
    if (name.trim() !== (member.name ?? "")) body.name = name;
    if (email.trim() !== member.email) body.email = email.trim();
    if (!isYou && role !== member.role) body.role = role;
    if (Object.keys(body).length === 0) return onDone();
    updateMember.mutate({ userId: member.id, body }, { onSuccess: onDone });
  }

  return (
    <div className="mt-2 rounded-lg border bg-muted/40 p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 className="font-medium">Edit {displayName(member)}</h2>
        <ErrorAlert
          message={getErrorMessage(updateMember, "Couldn't save the changes", {
            409: "Someone with that email already has an account.",
          })}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-user-name">Name</Label>
            <Input
              id="edit-user-name"
              maxLength={INPUT_LIMITS.personName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-user-email">Email</Label>
            <Input
              id="edit-user-email"
              maxLength={INPUT_LIMITS.email}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-user-role">Role</Label>
            <NativeSelect
              id="edit-user-role"
              className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-base md:h-8 md:text-sm disabled:opacity-50"
              value={role}
              disabled={isYou}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </NativeSelect>
            {isYou && (
              <span className="text-xs text-muted-foreground">
                You can&apos;t change your own role.
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Projects</span>
          <ProjectMemberships member={member} projects={projects} />
          {member.role !== "admin" && (
            <span className="text-xs text-muted-foreground">
              Project changes save straight away.
            </span>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!email.trim() || updateMember.isPending}
          >
            {updateMember.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
