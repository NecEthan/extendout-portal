import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/portal/PageHeader";
import { MockBanner } from "@/components/portal/MockBanner";
import { StatCard } from "@/components/portal/StatCard";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { MilestoneTimeline } from "@/components/portal/projects/MilestoneTimeline";
import { SiteEvidenceTabs } from "@/components/portal/evidence/SiteEvidenceTabs";
import { ProjectDocuments } from "@/components/documents/ProjectDocuments";
import { ProjectSearch } from "@/components/search/ProjectSearch";
import { getMockProject } from "@/mocks/projects";
import { mockMilestones, mockPlanItems } from "@/mocks/planning";
import { mockTeam } from "@/mocks/team";
import { mockInspections, mockIssues, mockPhotos } from "@/mocks/evidence";
import { applicationRoutes } from "@/utils/applicationRoutes";
import { formatDate, formatGBP } from "@/lib/format";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const project = getMockProject(id);
  if (!project) notFound();

  const milestones = mockMilestones.filter((m) => m.projectId === id);
  const plan = mockPlanItems.filter((p) => p.projectId === id);
  const team = mockTeam.filter((t) => t.projectIds.includes(id));
  const photos = mockPhotos.filter((p) => p.projectId === id);
  const inspections = mockInspections.filter((i) => i.projectId === id);
  const issues = mockIssues.filter((i) => i.projectId === id);

  const overview = (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Project details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Client", project.client],
            ["Address", project.address],
            ["Type", project.type],
            ["Site manager", project.manager],
            ["Start", formatDate(project.startDate)],
            ["Target completion", formatDate(project.endDate)],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{k}</span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
          <div className="col-span-2 flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span>{project.stage}</span>
              <span className="font-medium">{project.progress}%</span>
            </div>
            <Progress value={project.progress} />
          </div>
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

  const planning = (
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
            <Badge
              variant={
                p.bucket === "Now"
                  ? "solid"
                  : p.bucket === "Next"
                    ? "default"
                    : "neutral"
              }
            >
              {p.bucket}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const siteEvidence = (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button>
          <Upload /> Capture
        </Button>
      </div>
      <SiteEvidenceTabs
        photos={photos}
        inspections={inspections}
        issues={issues}
      />
    </div>
  );

  const teamTab = (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {team.map((t) => (
        <Card key={t.id} className="flex-row items-center gap-3 px-4">
          <span className="grid size-10 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">
            {t.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{t.name}</span>
            <span className="text-xs text-muted-foreground">{t.trade}</span>
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <>
      <Link
        href={applicationRoutes.projects}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={14} /> All projects
      </Link>
      <PageHeader
        title={project.name}
        description={`${project.type} for ${project.client}`}
        actions={<StatusBadge status={project.health} />}
      />
      <MockBanner />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Contract value" value={formatGBP(project.budget)} />
        <StatCard
          label="Costs to date"
          value={formatGBP(project.spent)}
          hint={`${Math.round((project.spent / project.budget) * 100)}% of budget`}
        />
        <StatCard label="Completion" value={formatDate(project.endDate)} />
      </div>
      <Tabs
        defaultValue={tab}
        tabs={[
          { value: "overview", label: "Overview", content: overview },
          { value: "planning", label: "Planning", content: planning },
          {
            value: "site-evidence",
            label: "Site evidence",
            content: siteEvidence,
          },
          {
            value: "documents",
            label: "Documents",
            content: <ProjectDocuments projectId={id} />,
          },
          {
            value: "search",
            label: "Search",
            content: <ProjectSearch projectId={id} />,
          },
          { value: "team", label: "Team", content: teamTab },
        ]}
      />
    </>
  );
}
