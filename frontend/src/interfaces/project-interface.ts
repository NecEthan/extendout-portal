/** A project as returned by GET /projects and GET /projects/{id}. */
export interface Project {
  id: number;
  name: string;
  client: string;
  address: string;
}

/** Body for POST /projects (admin only). The server assigns the id. */
export interface NewProject {
  name: string;
  client?: string;
  address?: string;
}

/** Body for PATCH /projects/{id} (admin only). Only the fields sent change. */
export type ProjectUpdate = Partial<NewProject>;
