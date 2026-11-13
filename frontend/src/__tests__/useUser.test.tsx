import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useUser } from "@/hooks/useUser";
import { respond } from "@/test-utils/mockApi";
import { api } from "@/lib/api/axiosClient";

function wrapper({ children }: { children: ReactNode }) {
  // retryDelay 0 so retried requests happen immediately in the test.
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const adapter = api.defaults.adapter as jest.Mock;

describe("useUser", () => {
  beforeEach(() => window.history.pushState({}, "", "/login"));

  it("doesn't retry when the answer is 401 (not logged in)", async () => {
    respond(401, { detail: "Not authenticated" });
    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("still retries other failures", async () => {
    respond(500, { detail: "boom" });
    respond(200, { id: "1", email: "sam@example.com" });
    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adapter).toHaveBeenCalledTimes(2);
  });
});
