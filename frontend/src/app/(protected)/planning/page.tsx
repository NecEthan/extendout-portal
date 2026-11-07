import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/portal/PageHeader";
import { MockBanner } from "@/components/portal/MockBanner";
import { MilestoneTimeline } from "@/components/portal/projects/MilestoneTimeline";
import { mockMilestones, mockPlanItems } from "@/mocks/planning";
import { getMockProject } from "@/mocks/projects";
import { formatDate } from "@/lib/format";
import type { PlanBucket } from "@/interfaces/portal";

const BUCKETS: { bucket: PlanBucket; hint: string; accent: string }[] = [
  { bucket: "Now", hint: "On site this week", accent: "bg-primary" },
  {
    bucket: "Next",
    hint: "Next 2–3 weeks",
    accent: "bg-[var(--brand-orange-400)]",
  },
  {
    bucket: "Then",
    hint: "Further out",
    accent: "bg-[var(--brand-orange-200)]",
  },
];

export default function PlanningPage() {
  return (
    <>
      <PageHeader
        title="Planning"
        description="Now / Next / Then across every live job, so trades and materials line up."
      />
      <MockBanner />

      <div className="grid gap-4 lg:grid-cols-3">
        {BUCKETS.map(({ bucket, hint, accent }) => {
          const items = mockPlanItems.filter((p) => p.bucket === bucket);
          return (
            <section
              key={bucket}
              className="flex flex-col gap-3 rounded-xl bg-secondary/60 p-3"
            >
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${accent}`} />
                  <h2 className="font-semibold">{bucket}</h2>
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {items.length}
                </span>
              </div>
              {items.map((p) => (
                <Card key={p.id} size="sm" className="gap-1 px-3">
                  <span className="text-sm font-medium">{p.title}</span>
                  <span className="text-xs text-primary">
                    {getMockProject(p.projectId)?.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.trade} · {formatDate(p.start)} to {formatDate(p.end)}
                  </span>
                </Card>
              ))}
            </section>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Key milestones: Surrey Rear Extension</CardTitle>
        </CardHeader>
        <CardContent>
          <MilestoneTimeline
            milestones={mockMilestones.filter((m) => m.projectId === "p-101")}
          />
        </CardContent>
      </Card>
    </>
  );
}
