"use client";

import { useState } from "react";
import { ProjectForm } from "@/components/portal/projects/ProjectForm";
import { useUpdateProject } from "@/hooks/useProjects";
import { getErrorMessage } from "@/lib/errorMessage";
import type { Project } from "@/interfaces";

/** Admin only: a project's details, read-only until Edit is clicked. The same
 * button then saves and locks the form again. */
export function EditProjectForm({ project }: { project: Project }) {
  const updateProject = useUpdateProject(project.id);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <>
      <ProjectForm
        project={project}
        submitLabel="Save changes"
        autoFocus={false}
        locked={!editing}
        onEdit={() => {
          setSaved(false);
          setEditing(true);
        }}
        pending={updateProject.isPending}
        error={getErrorMessage(updateProject, "Couldn't save the project")}
        onSubmit={(values) =>
          updateProject.mutate(values, {
            onSuccess: () => {
              setEditing(false);
              setSaved(true);
            },
          })
        }
      />
      {saved && (
        <p role="status" className="-mt-2 text-sm text-muted-foreground">
          Changes saved.
        </p>
      )}
    </>
  );
}
