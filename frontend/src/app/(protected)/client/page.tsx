"use client";

import { CalendarCheck, Mail, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/portal/PageHeader";
import { MockBanner } from "@/components/portal/MockBanner";
import { MilestoneTimeline } from "@/components/portal/projects/MilestoneTimeline";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useProject } from "@/hooks/useProjects";
import { getErrorMessage } from "@/lib/errorMessage";
import { clientProjectId, clientWelcome } from "@/mocks/client";
import { mockMilestones } from "@/mocks/planning";
import { formatDate } from "@/lib/format";

export default function ClientOverviewPage() {
  const projectQuery = useProject(clientProjectId);
  const milestones = mockMilestones.filter(
    (m) => m.projectId === clientProjectId
  );
  const next = milestones.find((m) => m.status !== "Complete");

  const project = projectQuery.data;
  if (!project) {
    return (
      <ErrorAlert
        message={getErrorMessage(projectQuery, "Failed to load your project", {
          403: "You don't have access to this project.",
          404: "Project not found.",
        })}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={`Welcome back, ${clientWelcome.clientName}`}
        description={`${project.name} · ${project.address}`}
      />
      <MockBanner />

      <Card className="mb-6 overflow-hidden bg-sidebar text-white ring-0">
        <CardContent className="flex flex-col gap-4 py-2 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-2xl flex-col gap-2">
            <span className="text-xs tracking-[0.18em] text-primary uppercase">
              Your build
            </span>
            <h2 className="text-xl font-semibold">{clientWelcome.headline}</h2>
            <p className="text-sm text-white/70">{clientWelcome.summary}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="gap-1 px-4">
              <span className="text-xs text-muted-foreground uppercase">
                Next milestone
              </span>
              <span className="font-semibold">{next?.title}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarCheck size={12} /> {next && formatDate(next.date)}
              </span>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Build timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <MilestoneTimeline milestones={milestones} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your ExtendOut team</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {clientWelcome.contacts.map((c) => (
              <div
                key={c.name}
                className="flex flex-col gap-1 border-b pb-4 last:border-0 last:pb-0"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.role}</span>
                <span className="flex items-center gap-1.5 text-xs">
                  <Phone size={12} className="text-primary" /> {c.phone}
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <Mail size={12} className="text-primary" /> {c.email}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
