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
async function extractErrorDetail(response: Response): Promise<string> {
  try {
    const { detail } = await response.json();
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const messages = detail.map((item) => item?.msg).filter(Boolean).join(", ");
      if (messages) return messages;
    }
  } catch {
    // ignore parse errors — fall through to the generic message
  }
  return `HTTP ${response.status}`;
}

export async function throwIfError(response: Response): Promise<void> {
  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorDetail(response));
  }
}

export async function httpClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  await throwIfError(response);

  return response.json() as Promise<T>;
}
