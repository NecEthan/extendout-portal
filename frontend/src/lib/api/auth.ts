import type { User } from "@/interfaces";
import { ApiError } from "./apiError";
import { api } from "./axiosClient";

export async function login(email: string, password: string): Promise<User> {
  const { data: user } = await api.post<User>("/auth/login", {
    email,
    password,
  });
  // Set a UI routing hint cookie on this domain so proxy.ts can see it.
  // Not a security token — backend still validates the real session cookie.
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `kg_ui_auth=1; path=/; SameSite=Strict${secure}`;
  return user;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch (error) {
    // An HTTP error (e.g. the session already expired) still means we're
    // logged out, so carry on; only a network failure is a real error.
    if (!(error instanceof ApiError)) throw error;
  }
  document.cookie = "kg_ui_auth=; path=/; max-age=0";
}

export async function getUser(): Promise<User> {
  const { data } = await api.get<User>("/auth/user");
  return data;
}
