import type { User } from "@/interfaces";
import { ApiError } from "./apiError";
import { apiRoutes } from "./apiRoutes";
import { api } from "./axiosClient";

/** Emails a 6-digit login code. The answer is the same whether or not the
 * email has an account. */
export async function requestCode(email: string): Promise<void> {
  await api.post(apiRoutes.auth.requestCode, { email });
}

/** Logs in with the emailed code. The backend sets the HttpOnly session
 * cookie (400 days); nothing to store here. */
export async function verifyCode(email: string, code: string): Promise<User> {
  const { data: user } = await api.post<User>(apiRoutes.auth.verifyCode, {
    email,
    code,
  });
  return user;
}

export async function logout(): Promise<void> {
  try {
    await api.post(apiRoutes.auth.logout);
  } catch (error) {
    // An HTTP error (e.g. the session already expired) still means we're
    // logged out, so carry on; only a network failure is a real error.
    if (!(error instanceof ApiError)) throw error;
  }
}

export async function getUser(): Promise<User> {
  const { data } = await api.get<User>(apiRoutes.auth.user);
  return data;
}
