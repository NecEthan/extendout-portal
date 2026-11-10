"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useProject } from "@/hooks/useProjects";
import { useUser } from "@/hooks/useUser";
import { getErrorMessage } from "@/lib/errorMessage";
import { BackLink } from "./components/BackLink";
import { ProjectHeader } from "./components/ProjectHeader";
import { OverviewTab } from "./components/OverviewTab";
import { SiteEvidenceTab } from "./components/SiteEvidenceTab";
import { DocumentsTab } from "./components/DocumentsTab";
import { SearchTab } from "./components/SearchTab";
import { TeamTab } from "./components/TeamTab";

export default function ProjectDetailPage() {
  const id = Number(useParams<{ id: string }>().id);
  const tab = useSearchParams().get("tab") ?? undefined;
  const projectQuery = useProject(id);
  const isAdmin = useUser().data?.role === "admin";

  const project = projectQuery.data;
  if (!project) {
    // Loading (renders just the back link), or 403 / 404 from the API.
    return (
      <>
        <BackLink />
        <ErrorAlert
          message={getErrorMessage(projectQuery, "Failed to load project", {
            403: "You don't have access to this project. Ask an admin to add you as a member.",
            404: "Project not found.",
            422: "Project not found.", // non-numeric id in the URL
          })}
        />
      </>
    );
  }

  const tabs = [
    {
      value: "overview",
      label: "Overview",
      content: <OverviewTab project={project} />,
    },
    {
      value: "site-evidence",
      label: "Site evidence",
      content: <SiteEvidenceTab projectId={id} />,
    },
    {
      value: "documents",
      label: "Documents",
      content: <DocumentsTab projectId={id} />,
    },
    {
      value: "search",
      label: "Search",
      content: <SearchTab projectId={id} />,
    },
  ];
  if (isAdmin) {
    tabs.push({
      value: "team",
      label: "Team",
      content: <TeamTab projectId={id} />,
    });
  }

  return (
    <>
      <BackLink />
      <ProjectHeader project={project} isAdmin={isAdmin} />
      <Tabs defaultValue={tab} tabs={tabs} />
    </>
  );
}
