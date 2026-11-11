"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project } from "@/interfaces";

export interface ProjectFormValues {
  name: string;
  client: string;
  address: string;
}

interface ProjectFormProps {
  /** The project being edited; omit when creating. */
  project?: Project;
  submitLabel: string;
  /** Show the saved values read-only with a single Edit button (calls onEdit)
   * in place of the submit button. */
  locked?: boolean;
  onEdit?: () => void;
  /** Focus the Name field on mount. Defaults to true (the Add form). */
  autoFocus?: boolean;
  pending: boolean;
  error: string | null;
  onSubmit: (values: ProjectFormValues) => void;
  /** Omit to hide the Cancel button. */
  onCancel?: () => void;
}

/** Admin only: the fields for creating or editing a project. */
export function ProjectForm({
  project,
  submitLabel,
  locked = false,
  onEdit,
  autoFocus = true,
  pending,
  error,
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const [name, setName] = useState(project?.name ?? "");
  const [client, setClient] = useState(project?.client ?? "");
  const [address, setAddress] = useState(project?.address ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name, client, address });
  }

  return (
    <Card className="mb-4">
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ErrorAlert message={error} />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={locked}
                placeholder="e.g. Surrey Rear Extension"
                required
                autoFocus={autoFocus}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-client">Client</Label>
              <Input
                id="project-client"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-address">Address</Label>
              <Input
                id="project-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={locked}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {locked ? (
              // Keyed apart from the submit button so React doesn't reuse the
              // element, and the click that unlocks can't also submit.
              <Button key="edit" type="button" onClick={onEdit}>
                <Pencil /> Edit
              </Button>
            ) : (
              <>
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                )}
                <Button
                  key="submit"
                  type="submit"
                  disabled={!name.trim() || pending}
                >
                  {pending ? "Saving…" : submitLabel}
                </Button>
              </>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
