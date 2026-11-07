export const applicationRoutes = {
  login: "/login",
  dashboard: "/dashboard",
  documents: "/documents",
  search: "/search",
  // Office
  projects: "/projects",
  planning: "/planning",
  materials: "/materials",
  team: "/team",
  // Client view
  clientOverview: "/client",
  progress: "/client/progress",
} as const;

export type ApplicationRoute =
  (typeof applicationRoutes)[keyof typeof applicationRoutes];
