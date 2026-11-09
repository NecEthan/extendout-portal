import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// FastAPI's manually-raised HTTPExceptions send `detail` as a string, but
// its automatic Pydantic validation errors send `detail` as an array of
// {loc, msg, type} objects — normalize both into one readable string.
function extractErrorDetail(data: unknown, status: number): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join(", ");
    if (messages) return messages;
  }
  return `HTTP ${status}`;
}

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const { status, data } = error.response;
      return Promise.reject(
        new ApiError(status, extractErrorDetail(data, status))
      );
    }
    return Promise.reject(error);
  }
);
