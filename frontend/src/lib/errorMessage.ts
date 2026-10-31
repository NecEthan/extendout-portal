import { ApiError } from "@/lib/api/client";
import type { ErrorSource } from "@/interfaces";

export function getErrorMessage(
  source: ErrorSource,
  fallback: string,
  statusOverrides?: Record<number, string>,
): string | null {
  if (!source.isError) return null;
  if (source.error instanceof ApiError) {
    return statusOverrides?.[source.error.status] ?? source.error.message;
  }
  return fallback;
}

export function firstErrorMessage(sources: [ErrorSource, string][]): string | null {
  for (const [source, fallback] of sources) {
    const message = getErrorMessage(source, fallback);
    if (message) return message;
  }
  return null;
}
