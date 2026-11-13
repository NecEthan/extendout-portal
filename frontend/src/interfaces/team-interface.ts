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
  project_ids: number[];
}

/** Body for POST /team (admin only): create an account for someone. There's
 * no password: they log in with a code emailed to them. */
export interface NewUser {
  email: string;
  role: UserRole;
  name?: string;
}

/** Body for PATCH /team/{id} (admin only). Only the fields sent change. */
export interface TeamMemberUpdate {
  email?: string;
  name?: string;
  role?: UserRole;
}
