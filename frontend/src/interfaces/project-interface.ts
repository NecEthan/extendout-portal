export type ProjectHealth = "On track" | "At risk" | "Delayed" | "Complete";

/** A project as returned by GET /projects and GET /projects/{id}. */
export interface Project {
  id: string;
  name: string;
  client: string;
  address: string;
  health: ProjectHealth;
}
