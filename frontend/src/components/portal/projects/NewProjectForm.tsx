"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateProject } from "@/hooks/useProjects";
import { getErrorMessage } from "@/lib/errorMessage";
import { applicationRoutes } from "@/utils/applicationRoutes";

/** Admin only: create a project, then open it. */
export function NewProjectForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const createProject = useCreateProject();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [address, setAddress] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createProject.mutate(
      { name, client, address },
      {
        onSuccess: (project) =>
          router.push(`${applicationRoutes.projects}/${project.id}`),
      }
    );
  }

  return (
    <Card className="mb-4">
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ErrorAlert
            message={getErrorMessage(
              createProject,
              "Couldn't create the project"
            )}
          />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Surrey Rear Extension"
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-client">Client</Label>
              <Input
                id="project-client"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-address">Address</Label>
              <Input
                id="project-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || createProject.isPending}
            >
              {createProject.isPending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
