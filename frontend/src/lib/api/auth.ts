import type { User } from "@/interfaces";
import { ApiError } from "./apiError";
import { apiRoutes } from "./apiRoutes";
import { api } from "./axiosClient";

export async function login(email: string, password: string): Promise<User> {
  // The backend sets the HttpOnly session cookie; nothing to store here.
  const { data: user } = await api.post<User>(apiRoutes.login, {
    email,
    password,
  });
  return user;
}

export async function logout(): Promise<void> {
  try {
    await api.post(apiRoutes.logout);
  } catch (error) {
    // An HTTP error (e.g. the session already expired) still means we're
    // logged out, so carry on; only a network failure is a real error.
    if (!(error instanceof ApiError)) throw error;
  }
}

export async function getUser(): Promise<User> {
  const { data } = await api.get<User>(apiRoutes.currentUser);
  return data;
}
