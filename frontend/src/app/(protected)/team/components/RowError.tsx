import type { ErrorSource } from "@/interfaces";
import { getErrorMessage } from "@/lib/errorMessage";

/** A mutation's error, shown under the control in its table row. */
export function RowError({
  source,
  fallback,
}: {
  source: ErrorSource;
  fallback: string;
}) {
  const message = getErrorMessage(source, fallback);
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}
