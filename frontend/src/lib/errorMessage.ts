import { ApiError } from "@/lib/api/apiError";
import type { ErrorSource } from "@/interfaces";

export function getErrorMessage(
  source: ErrorSource,
  fallback: string,
  statusOverrides?: Record<number, string>
): string | null {
  if (!source.isError) return null;
  if (source.error instanceof ApiError) {
    return statusOverrides?.[source.error.status] ?? source.error.message;
  }
  return fallback;
}

export function firstErrorMessage(
  sources: [ErrorSource, string, Record<number, string>?][]
): string | null {
  for (const [source, fallback, statusOverrides] of sources) {
    const message = getErrorMessage(source, fallback, statusOverrides);
    if (message) return message;
  }
  return null;
}

/** Shown when the backend rate-limits an upload (HTTP 429). */
export const UPLOAD_RATE_LIMITED =
  "You're uploading too quickly. Wait a minute and try again.";
