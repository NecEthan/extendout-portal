"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/PageHeader";
import { MockBanner } from "@/components/portal/MockBanner";
import { ProjectCard } from "@/components/portal/projects/ProjectCard";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useProjects } from "@/hooks/useProjects";
import { getErrorMessage } from "@/lib/errorMessage";

export default function ProjectsPage() {
  const projects = useProjects();

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every job in one place: quotes, plans, people and progress."
        actions={
          <Button>
            <Plus /> New project
          </Button>
        }
      />
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
