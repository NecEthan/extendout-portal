export type UserRole = "admin" | "builder" | "client";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}
