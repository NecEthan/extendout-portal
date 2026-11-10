"use client";

import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { ProjectCard } from "@/components/portal/projects/ProjectCard";
import { useProjects } from "@/hooks/useProjects";
import { applicationRoutes } from "@/utils/applicationRoutes";

export default function DashboardPage() {
  const projects = useProjects().data ?? [];

  return (
    <>
      <PageHeader
        title="Good morning"
        description="Here's what's happening across your ExtendOut projects today."
      />

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Projects"
          value={String(projects.length)}
          icon={FolderKanban}
        />
      </div>

      <section className="mt-8 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects</h2>
          <Link
            href={applicationRoutes.projects}
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </section>
    </>
  );
}
