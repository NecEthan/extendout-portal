import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/PageHeader";
import { MockBanner } from "@/components/portal/MockBanner";
import { ProjectCard } from "@/components/portal/projects/ProjectCard";
import { mockProjects } from "@/mocks/projects";

export default function ProjectsPage() {
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mockProjects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </>
  );
}
