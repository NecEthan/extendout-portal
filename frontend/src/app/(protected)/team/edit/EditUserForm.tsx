"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { displayName, ROLES, roleLabel } from "@/components/team/Person";
import { useUpdateTeamMember } from "@/hooks/useTeam";
import { getErrorMessage } from "@/lib/errorMessage";
import type { TeamMember, TeamMemberUpdate, UserRole } from "@/interfaces";

/** Admin only: edit someone's name, email and role, or reset their password.
 * Admins can't change their own role (the backend refuses it too). */
export function EditUserForm({
  member,
  isYou,
  onDone,
}: {
  member: TeamMember;
  isYou: boolean;
  onDone: () => void;
}) {
  const updateMember = useUpdateTeamMember();
  const [name, setName] = useState(member.name ?? "");
  const [email, setEmail] = useState(member.email);
  const [role, setRole] = useState<UserRole>(member.role);
  const [password, setPassword] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const body: TeamMemberUpdate = {};
    if (name.trim() !== (member.name ?? "")) body.name = name;
    if (email.trim() !== member.email) body.email = email.trim();
    if (!isYou && role !== member.role) body.role = role;
    if (password) body.password = password;
    if (Object.keys(body).length === 0) return onDone();
    updateMember.mutate({ userId: member.id, body }, { onSuccess: onDone });
  }

  return (
    <Card className="mt-4">
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <h2 className="font-medium">Edit {displayName(member)}</h2>
          <ErrorAlert
            message={getErrorMessage(
              updateMember,
              "Couldn't save the changes",
              {
                409: "Someone with that email already has an account.",
              }
            )}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-user-name">Name</Label>
              <Input
                id="edit-user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-user-email">Email</Label>
              <Input
                id="edit-user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-user-role">Role</Label>
              <select
                id="edit-user-role"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-50"
                value={role}
                disabled={isYou}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
              {isYou && (
                <span className="text-xs text-muted-foreground">
                  You can&apos;t change your own role.
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-user-password">New password</Label>
              <PasswordInput
                id="edit-user-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep the current one"
              />
              <span className="text-xs text-muted-foreground">
                At least 8 characters, with an uppercase letter and a number.
                {!isYou && " Setting one signs them out everywhere."}
              </span>
            </div>
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
      </CardContent>
    </Card>
  );
}
