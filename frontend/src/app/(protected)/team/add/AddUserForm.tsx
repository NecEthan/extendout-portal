"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLES, roleLabel } from "@/components/team/Person";
import { useCreateUser } from "@/hooks/useTeam";
import { getErrorMessage } from "@/lib/errorMessage";
import type { UserRole } from "@/interfaces";

/** Admin only: create an account. There's no password: they log in with a
 * code emailed to them. Add them to projects from the team list. */
export function AddUserForm({ onDone }: { onDone: () => void }) {
  const createUser = useCreateUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("client");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createUser.mutate(
      { name, email: email.trim(), role },
      { onSuccess: onDone }
    );
  }

  return (
    <Card className="mt-4">
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ErrorAlert
            message={getErrorMessage(createUser, "Couldn't create the user", {
              409: "Someone with that email already has an account.",
            })}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-name">Name</Label>
              <Input
                id="user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <span className="text-xs text-muted-foreground">
                They sign in with a code sent to this address.
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-role">Role</Label>
              <select
                id="user-role"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!email.trim() || createUser.isPending}
            >
              {createUser.isPending ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
