import { ApiError } from "@/lib/api/apiError";
import { getUser, login } from "@/lib/api/auth";
import { navigateTo } from "@/lib/navigation";
import { createUser } from "@/lib/api/team";
import { lastRequest, networkError, respond } from "@/test-utils/mockApi";

jest.mock("@/lib/navigation", () => ({ navigateTo: jest.fn() }));

const newUser = { email: "a@b.com", password: "pw", role: "builder" as const };

describe("axios client", () => {
  it("returns parsed JSON on success", async () => {
    respond(200, { id: "1", email: "test@example.com" });
    await expect(getUser()).resolves.toEqual({
      id: "1",
      email: "test@example.com",
    });
  });

  it("throws ApiError with detail from response body on failure", async () => {
    respond(409, { detail: "Email already registered" });
    await expect(createUser(newUser)).rejects.toMatchObject({
      status: 409,
      message: "Email already registered",
    });
  });

  it("throws ApiError with fallback message when response has no detail", async () => {
    respond(500, "Internal Server Error");
    await expect(getUser()).rejects.toMatchObject({
      status: 500,
      message: "HTTP 500",
    });
  });

  it("joins FastAPI's auto-validation array-shaped detail into a readable message", async () => {
    respond(422, {
      detail: [
        { loc: ["body", "email"], msg: "field required", type: "missing" },
        {
          loc: ["body", "password"],
          msg: "string too short",
          type: "value_error",
        },
      ],
    });
    await expect(createUser(newUser)).rejects.toMatchObject({
      status: 422,
      message: "field required, string too short",
    });
  });

  it("throws ApiError instance", async () => {
    respond(403, { detail: "Admins only" });
    await expect(getUser()).rejects.toBeInstanceOf(ApiError);
  });

  it("passes network errors through (not an ApiError)", async () => {
    networkError();
    const error = await getUser().catch((e) => e);
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error.message).toBe("Network Error");
  });

  it("sends cookies and uses the API base URL", async () => {
    respond(200, {});
    await getUser();
    const req = lastRequest();
    expect(req.withCredentials).toBe(true);
    expect(req.baseURL).toBe("http://localhost:8000");
    expect(req.url).toBe("/auth/user");
  });

  it("sends JSON bodies", async () => {
    respond(201, {});
    await createUser(newUser);
    const req = lastRequest();
    expect(req.method).toBe("post");
    expect(JSON.parse(req.data)).toEqual(newUser);
  });
});

describe("expired session (401)", () => {
  beforeEach(() => {
    jest.mocked(navigateTo).mockReset();
    window.history.pushState({}, "", "/projects/1");
    document.cookie = "kg_ui_auth=1; path=/";
  });

  it("clears the UI auth cookie and redirects to /login", async () => {
    respond(401, { detail: "Session invalid or expired" });
    let settled = false;
    getUser().finally(() => (settled = true));
    await new Promise((r) => setTimeout(r, 0));

    expect(navigateTo).toHaveBeenCalledWith("/login");
    expect(document.cookie).not.toContain("kg_ui_auth=1");
    // Never settles, so screens don't flash an error while navigating away.
    expect(settled).toBe(false);
  });

  it("does not redirect on a failed login (wrong password)", async () => {
    window.history.pushState({}, "", "/login");
    respond(401, { detail: "Invalid credentials" });
    await expect(login("a@b.com", "wrong")).rejects.toMatchObject({
      status: 401,
      message: "Invalid credentials",
    });
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it("rejects instead of redirecting when already on /login", async () => {
    window.history.pushState({}, "", "/login");
    respond(401, { detail: "Not authenticated" });
    await expect(getUser()).rejects.toBeInstanceOf(ApiError);
    expect(navigateTo).not.toHaveBeenCalled();
  });
});
