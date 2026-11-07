import Link from "next/link";
import { MapPin, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { applicationRoutes } from "@/utils/applicationRoutes";
import type { Project } from "@/interfaces";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`${applicationRoutes.projects}/${project.id}`}
      className="group"
    >
      <Card className="h-full gap-3 px-4 transition-shadow group-hover:shadow-md group-hover:ring-primary/30">
        <div className="flex items-start justify-between gap-2">
          <span className="font-heading font-semibold group-hover:text-primary">
            {project.name}
          </span>
          <StatusBadge status={project.health} />
        </div>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User size={12} /> {project.client}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={12} /> {project.address}
          </span>
        </div>
      </Card>
    </Link>
  );
}
