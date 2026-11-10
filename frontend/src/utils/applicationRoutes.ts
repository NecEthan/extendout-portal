export const applicationRoutes = {
  login: "/login",
  dashboard: "/dashboard",
  // Office
  projects: "/projects",
  team: "/team",
  // Client view
  clientOverview: "/client",
  progress: "/client/progress",
} as const;

export type ApplicationRoute =
  (typeof applicationRoutes)[keyof typeof applicationRoutes];
