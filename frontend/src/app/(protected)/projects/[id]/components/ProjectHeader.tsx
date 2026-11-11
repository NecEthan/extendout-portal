import { PageHeader } from "@/components/portal/PageHeader";
import type { Project } from "@/interfaces";

/** Project name and client. Editing lives on the admin-only Settings tab. */
export function ProjectHeader({ project }: { project: Project }) {
  return (
    <PageHeader title={project.name} description={`For ${project.client}`} />
  );
}
