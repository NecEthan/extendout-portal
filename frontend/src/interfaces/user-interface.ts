export type UserRole = "admin" | "builder" | "client";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  created_at: string;
}
