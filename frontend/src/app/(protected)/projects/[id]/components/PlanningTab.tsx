import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PlanBucket } from "@/interfaces/portal-interface";
import { formatDate } from "@/lib/format";
import { mockPlanItems } from "@/mocks/planning";

const BUCKET_VARIANTS: Record<PlanBucket, BadgeVariant> = {
  Now: "solid",
  Next: "default",
  Then: "neutral",
};

export function PlanningTab({ projectId }: { projectId: number }) {
  const plan = mockPlanItems.filter((p) => p.projectId === projectId);

  return (
    <Card>
      <CardContent className="flex flex-col divide-y">
        {plan.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
        )}
        {plan.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{p.title}</span>
              <span className="text-xs text-muted-foreground">
                {p.trade} · {formatDate(p.start)} to {formatDate(p.end)}
              </span>
            </div>
            <Badge variant={BUCKET_VARIANTS[p.bucket]}>{p.bucket}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
