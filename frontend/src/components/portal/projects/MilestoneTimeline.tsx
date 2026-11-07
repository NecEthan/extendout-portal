import { CheckCircle2, Circle, CircleDot, AlertCircle } from "lucide-react";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { formatDate } from "@/lib/format";
import type { Milestone } from "@/interfaces/portal";

const ICONS = {
  Complete: <CheckCircle2 size={18} className="text-success" />,
  "In progress": <CircleDot size={18} className="text-primary" />,
  Upcoming: <Circle size={18} className="text-muted-foreground" />,
  Delayed: <AlertCircle size={18} className="text-destructive" />,
};

export function MilestoneTimeline({ milestones }: { milestones: Milestone[] }) {
  return (
    <ol className="flex flex-col">
      {milestones.map((m, i) => (
        <li key={m.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            {ICONS[m.status]}
            {i < milestones.length - 1 && (
              <span className="w-px flex-1 bg-border" />
            )}
          </div>
          <div className="flex flex-1 items-start justify-between gap-2 pb-5">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{m.title}</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(m.date)}
              </span>
            </div>
            <StatusBadge status={m.status} />
          </div>
        </li>
      ))}
    </ol>
  );
}
