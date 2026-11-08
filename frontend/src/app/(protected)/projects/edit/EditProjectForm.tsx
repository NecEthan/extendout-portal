"use client";

import { ProjectForm } from "@/components/portal/projects/ProjectForm";
import { useUpdateProject } from "@/hooks/useProjects";
import { getErrorMessage } from "@/lib/errorMessage";
import type { Project } from "@/interfaces";

/** Admin only: edit a project's details. Calls onDone after saving or cancelling. */
export function EditProjectForm({
  project,
  onDone,
}: {
  project: Project;
  onDone: () => void;
}) {
  const updateProject = useUpdateProject(project.id);

  return (
    <ProjectForm
      project={project}
      submitLabel="Save changes"
      pending={updateProject.isPending}
      error={getErrorMessage(updateProject, "Couldn't save the project")}
      onSubmit={(values) => updateProject.mutate(values, { onSuccess: onDone })}
      onCancel={onDone}
    />
  );
}
