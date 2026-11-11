import { logout } from "@/lib/api/auth";
import { lastRequest, networkError, respond } from "@/test-utils/mockApi";

describe("logout", () => {
  it("posts to /auth/logout", async () => {
    respond(204);
    await logout();
    expect(lastRequest().url).toBe("/auth/logout");
  });

  it("still logs out locally when the backend returns an error", async () => {
    respond(401, { detail: "Not authenticated" });
    await expect(logout()).resolves.toBeUndefined();
  });

  it("rejects on a network failure", async () => {
    networkError();
    await expect(logout()).rejects.toThrow("Network Error");
  });
});
