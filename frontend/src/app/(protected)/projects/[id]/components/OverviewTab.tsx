import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MilestoneTimeline } from "@/components/portal/projects/MilestoneTimeline";
import type { Project } from "@/interfaces";
import { mockMilestones } from "@/mocks/milestones";

export function OverviewTab({ project }: { project: Project }) {
  const milestones = mockMilestones.filter((m) => m.projectId === project.id);
  const details = [
    ["Client", project.client],
    ["Address", project.address],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Project details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          {details.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          {milestones.length ? (
            <MilestoneTimeline milestones={milestones} />
          ) : (
            <p className="text-sm text-muted-foreground">No milestones yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
