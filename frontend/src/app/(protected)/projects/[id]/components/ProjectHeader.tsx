"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/PageHeader";
import type { Project } from "@/interfaces";
import { EditProjectForm } from "../../edit/EditProjectForm";

/** Project name and client, plus the admin-only Edit button and form. */
export function ProjectHeader({
  project,
  isAdmin,
}: {
  project: Project;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <PageHeader
        title={project.name}
        description={`For ${project.client}`}
        actions={
          isAdmin &&
          !editing && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
          )
        }
      />
      {editing && (
        <EditProjectForm project={project} onDone={() => setEditing(false)} />
      )}
    </>
  );
}
