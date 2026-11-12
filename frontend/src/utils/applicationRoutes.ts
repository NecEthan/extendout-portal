export type ProjectTab =
  "overview" | "photos" | "documents" | "search" | "team" | "settings";

export const applicationRoutes = {
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  team: "/team",

  projects: "/projects",
  project: (projectId: number | string, tab?: ProjectTab) =>
    `/projects/${encodeURIComponent(projectId)}${tab ? `?tab=${tab}` : ""}`,

  client: "/client",
  clientProgress: "/client/progress",

  documentVersions: (documentId: string, projectId?: number | string | null) =>
    `/documents/${encodeURIComponent(documentId)}/versions${
      projectId != null ? `?project=${encodeURIComponent(projectId)}` : ""
    }`,
};
