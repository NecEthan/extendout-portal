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
export function extractErrorDetail(data: unknown, status: number): string {
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
