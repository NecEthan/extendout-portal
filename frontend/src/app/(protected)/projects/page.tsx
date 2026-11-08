"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/PageHeader";
import { MockBanner } from "@/components/portal/MockBanner";
import { ProjectCard } from "@/components/portal/projects/ProjectCard";
import { NewProjectForm } from "@/components/portal/projects/NewProjectForm";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useProjects } from "@/hooks/useProjects";
import { useUser } from "@/hooks/useUser";
import { getErrorMessage } from "@/lib/errorMessage";

export default function ProjectsPage() {
  const projects = useProjects();
  const isAdmin = useUser().data?.role === "admin";
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every job in one place: quotes, plans, people and progress."
        actions={
          isAdmin &&
          !creating && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> New project
            </Button>
          )
        }
      />
      {creating && <NewProjectForm onCancel={() => setCreating(false)} />}
      <MockBanner />
      <ErrorAlert
        message={getErrorMessage(projects, "Failed to load projects")}
      />
      {projects.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t been added to any projects yet.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.data?.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </>
  );
}
