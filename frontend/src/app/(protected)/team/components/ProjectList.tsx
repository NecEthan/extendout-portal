import { Badge } from "@/components/ui/badge";
import type { Project, TeamMember } from "@/interfaces";

// Beyond this, the rest are summed up as "+N more" (all listed in its tooltip).
const MAX_SHOWN = 3;

/** Read-only list of the projects someone belongs to, for a Team row. */
export function ProjectList({
  member,
  projects,
}: {
  member: TeamMember;
  projects: Project[];
}) {
  // Admins can access every project, so memberships don't apply to them.
  if (member.role === "admin") {
    return <span className="text-sm text-muted-foreground">All projects</span>;
  }
  if (member.project_ids.length === 0) {
    return <span className="text-sm text-muted-foreground">No projects</span>;
  }

  const names = member.project_ids.map(
    (id) => projects.find((p) => p.id === id)?.name ?? `Project ${id}`
  );
  const hidden = names.slice(MAX_SHOWN);

  return (
    <ul
      aria-label="Projects"
      className="flex min-w-0 flex-wrap items-center gap-1.5"
    >
      {names.slice(0, MAX_SHOWN).map((name, i) => (
        <li key={member.project_ids[i]} className="max-w-full min-w-0">
          <Badge variant="outline" className="max-w-full text-foreground">
            <span className="truncate">{name}</span>
          </Badge>
        </li>
      ))}
      {hidden.length > 0 && (
        <li title={hidden.join(", ")} className="text-xs text-muted-foreground">
          +{hidden.length} more
        </li>
      )}
    </ul>
  );
}
