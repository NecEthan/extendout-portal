"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/portal/PageHeader";
import { MockBanner } from "@/components/portal/MockBanner";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { MilestoneTimeline } from "@/components/portal/projects/MilestoneTimeline";
import { SiteEvidenceTabs } from "@/components/portal/evidence/SiteEvidenceTabs";
import { ProjectDocuments } from "@/components/documents/ProjectDocuments";
import { ProjectSearch } from "@/components/search/ProjectSearch";
import { ProjectTeam } from "@/components/team/ProjectTeam";
import { mockMilestones, mockPlanItems } from "@/mocks/planning";
import { mockInspections, mockIssues, mockPhotos } from "@/mocks/evidence";
import { applicationRoutes } from "@/utils/applicationRoutes";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useProject } from "@/hooks/useProjects";
import { useUser } from "@/hooks/useUser";
import { getErrorMessage } from "@/lib/errorMessage";
import { formatDate } from "@/lib/format";

const backLink = (
  <Link
    href={applicationRoutes.projects}
    className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
  >
    <ArrowLeft size={14} /> All projects
  </Link>
);

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tab = useSearchParams().get("tab") ?? undefined;
  const projectQuery = useProject(id);
  const isAdmin = useUser().data?.role === "admin";

  const project = projectQuery.data;
  if (!project) {
    // Loading (renders just the back link), or 403 / 404 from the API.
    return (
      <>
        {backLink}
        <ErrorAlert
          message={getErrorMessage(projectQuery, "Failed to load project", {
            403: "You don't have access to this project. Ask an admin to add you as a member.",
            404: "Project not found.",
          })}
        />
      </>
    );
  }

  const milestones = mockMilestones.filter((m) => m.projectId === id);
  const plan = mockPlanItems.filter((p) => p.projectId === id);
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
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{k}</span>
              <span className="font-medium">{v}</span>
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

  return (
    <>
      {backLink}
      <PageHeader
        title={project.name}
        description={`For ${project.client}`}
        actions={<StatusBadge status={project.health} />}
      />
      <MockBanner />
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
          ...(isAdmin
            ? [
                {
                  value: "team",
                  label: "Team",
                  content: <ProjectTeam projectId={id} />,
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
