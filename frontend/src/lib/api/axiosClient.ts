import axios from "axios";
import { navigateTo } from "@/lib/navigation";
import { applicationRoutes } from "@/utils/applicationRoutes";
import { ApiError, extractErrorDetail } from "./apiError";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Shared axios instance for every backend call.
 * - `withCredentials` sends the session cookie.
 * - axios rejects any non-2xx response; the interceptor turns those into an
 *   ApiError with the backend's message. Network errors (no response) pass
 *   through unchanged, so callers show their generic fallback message.
 * - JSON bodies are serialised automatically, and FormData bodies get the
 *   multipart header (with boundary) set by the browser.
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Endpoints where a 401 is a normal answer (e.g. wrong password), not an
// expired session, so the caller handles it instead of being redirected.
const AUTH_ENDPOINTS = ["/auth/login", "/auth/logout"];

/**
 * Not logged in, or the session expired. This is how protected pages send
 * logged-out visitors to /login: every page loads the current user, so the
 * first request gets a 401 and lands here. Returns false if we're already
 * on the login page (so it can show its own errors without a redirect loop).
 */
function redirectToLogin(): boolean {
  if (window.location.pathname === applicationRoutes.login) return false;
  navigateTo(applicationRoutes.login);
  return true;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const { status, data } = error.response;
      const url = error.config?.url ?? "";
      if (
        status === 401 &&
        !AUTH_ENDPOINTS.includes(url) &&
        redirectToLogin()
      ) {
        // The page is navigating away: never settle, so callers don't flash
        // an error message or retry the request in the meantime.
        return new Promise(() => {});
      }
      return Promise.reject(
        new ApiError(status, extractErrorDetail(data, status))
      );
    }
    return Promise.reject(error);
  }
);
