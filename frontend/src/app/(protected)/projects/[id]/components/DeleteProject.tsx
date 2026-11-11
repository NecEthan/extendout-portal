"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeleteProject } from "@/hooks/useProjects";
import { getErrorMessage } from "@/lib/errorMessage";
import { applicationRoutes } from "@/utils/applicationRoutes";
import type { Project } from "@/interfaces";

/** Admin only: permanently delete the project, after typing its name to
 * confirm. Goes back to the projects list once done. */
export function DeleteProject({ project }: { project: Project }) {
  const router = useRouter();
  const deleteProject = useDeleteProject(project.id);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [copied, setCopied] = useState(false);
  const matches = typed.trim() === project.name.trim();

  async function copyName() {
    try {
      await navigator.clipboard.writeText(project.name);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  function cancel() {
    setConfirming(false);
    setTyped("");
    deleteProject.reset();
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Delete project</CardTitle>
        <CardDescription>
          Permanently deletes this project with all its documents (every
          version), site photos and team access. This can&apos;t be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ErrorAlert
          message={getErrorMessage(
            deleteProject,
            "Couldn't delete the project"
          )}
        />
        {!confirming ? (
          <div>
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              <Trash2 /> Delete project
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!matches) return;
              deleteProject.mutate(undefined, {
                onSuccess: () => router.replace(applicationRoutes.projects),
              });
            }}
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">Project name:</span>
                <code className="rounded bg-muted px-1.5 py-0.5 select-all">
                  {project.name}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={copyName}
                  aria-label={copied ? "Copied" : "Copy project name"}
                  title={copied ? "Copied" : "Copy project name"}
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
              <Label htmlFor="confirm-project-name">
                Type the project name to confirm
              </Label>
              <Input
                id="confirm-project-name"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="destructive"
                disabled={!matches || deleteProject.isPending}
              >
                {deleteProject.isPending ? "Deleting…" : "Delete permanently"}
              </Button>
              <Button type="button" variant="outline" onClick={cancel}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
