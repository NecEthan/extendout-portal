/** Tabs on a project's page (`?tab=`). */
export type ProjectTab =
  "overview" | "photos" | "documents" | "search" | "team";

/** Every page route in the app. Build links from here, never by hand. */
export const applicationRoutes = {
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  // Office
  projects: "/projects",
  team: "/team",
  // Client view
  clientOverview: "/client",
  progress: "/client/progress",

  /** A project's page, optionally opened on a tab. */
  project: (projectId: number | string, tab?: ProjectTab) =>
    `/projects/${encodeURIComponent(projectId)}${tab ? `?tab=${tab}` : ""}`,

  /** A document's version history. Pass the project so "Back to documents"
   * can return to that project's Documents tab. */
  documentVersions: (documentId: string, projectId?: number | string | null) =>
    `/documents/${encodeURIComponent(documentId)}/versions${
      projectId != null ? `?project=${encodeURIComponent(projectId)}` : ""
    }`,
} as const;

export type ApplicationRoute = Extract<
  (typeof applicationRoutes)[keyof typeof applicationRoutes],
  string
>;
