import { logout } from "@/lib/api/auth";
import { lastRequest, networkError, respond } from "@/test-utils/mockApi";

describe("logout", () => {
  beforeEach(() => {
    document.cookie = "eo_ui_auth=1; path=/";
  });

  it("posts to /auth/logout and clears the UI auth cookie", async () => {
    respond(204);
    await logout();
    expect(lastRequest().url).toBe("/auth/logout");
    expect(document.cookie).not.toContain("eo_ui_auth=1");
  });

  it("still logs out locally when the backend returns an error", async () => {
    respond(401, { detail: "Not authenticated" });
    await expect(logout()).resolves.toBeUndefined();
    expect(document.cookie).not.toContain("eo_ui_auth=1");
  });

  it("rejects on a network failure", async () => {
    networkError();
    await expect(logout()).rejects.toThrow("Network Error");
  });
});
