import Link from "next/link";
import { MapPin, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { applicationRoutes } from "@/utils/applicationRoutes";
import { formatGBP } from "@/lib/format";
import type { Project } from "@/interfaces/portal";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`${applicationRoutes.projects}/${project.id}`}
      className="group"
    >
      <Card className="h-full gap-3 px-4 transition-shadow group-hover:shadow-md group-hover:ring-primary/30">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="font-heading font-semibold group-hover:text-primary">
              {project.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {project.type}
            </span>
          </div>
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
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span>{project.stage}</span>
            <span className="font-medium">{project.progress}%</span>
          </div>
          <Progress
            value={project.progress}
            label={`${project.name} progress`}
          />
        </div>
        <div className="flex justify-between border-t pt-3 text-xs">
          <span className="text-muted-foreground">Budget</span>
          <span className="font-medium">
            {formatGBP(project.spent)} / {formatGBP(project.budget)}
          </span>
        </div>
      </Card>
    </Link>
  );
}
