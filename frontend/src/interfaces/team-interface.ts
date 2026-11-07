import type { UserRole } from "./user-interface";

/** A person on a project (GET /projects/{id}/members). */
export interface Member {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

/** A person on the Team page (GET /team), with the projects they belong to. */
export interface TeamMember extends Member {
  project_ids: string[];
}
