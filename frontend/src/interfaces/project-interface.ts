export type ProjectHealth = "On track" | "At risk" | "Delayed" | "Complete";

/** A project as returned by GET /projects and GET /projects/{id}. */
export interface Project {
  id: number;
  name: string;
  client: string;
  address: string;
  health: ProjectHealth;
}

/** Body for POST /projects (admin only). The server assigns the id. */
export interface NewProject {
  name: string;
  client?: string;
  address?: string;
}
