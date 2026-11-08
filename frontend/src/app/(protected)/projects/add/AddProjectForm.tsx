"use client";

import { useRouter } from "next/navigation";
import { ProjectForm } from "@/components/portal/projects/ProjectForm";
import { useCreateProject } from "@/hooks/useProjects";
import { getErrorMessage } from "@/lib/errorMessage";
import { applicationRoutes } from "@/utils/applicationRoutes";

/** Admin only: create a project, then open it. */
export function AddProjectForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const createProject = useCreateProject();

  return (
    <ProjectForm
      submitLabel="Create project"
      pending={createProject.isPending}
      error={getErrorMessage(createProject, "Couldn't create the project")}
      onSubmit={(values) =>
        createProject.mutate(values, {
          onSuccess: (project) =>
            router.push(`${applicationRoutes.projects}/${project.id}`),
        })
      }
      onCancel={onCancel}
    />
  );
}
