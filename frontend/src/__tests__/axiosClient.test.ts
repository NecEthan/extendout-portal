import { ApiError } from "@/lib/api/apiError";
import { getUser, requestCode, verifyCode } from "@/lib/api/auth";
import { navigateTo } from "@/lib/navigation";
import { createUser } from "@/lib/api/team";
import { lastRequest, networkError, respond } from "@/test-utils/mockApi";

jest.mock("@/lib/navigation", () => ({ navigateTo: jest.fn() }));

const newUser = { email: "a@b.com", role: "builder" as const };

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
          loc: ["body", "role"],
          msg: "invalid role",
          type: "value_error",
        },
      ],
    });
    await expect(createUser(newUser)).rejects.toMatchObject({
      status: 422,
      message: "field required, invalid role",
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
  });

  it("redirects to /login", async () => {
    respond(401, { detail: "Session invalid or expired" });
    let settled = false;
    getUser().finally(() => (settled = true));
    await new Promise((r) => setTimeout(r, 0));

    expect(navigateTo).toHaveBeenCalledWith("/login");
    // Never settles, so screens don't flash an error while navigating away.
    expect(settled).toBe(false);
  });

  it("does not redirect on a wrong login code", async () => {
    // Even off /login: a 401 from the code endpoints is an answer, not an
    // expired session.
    respond(401, { detail: "That code is wrong or has expired." });
    await expect(verifyCode("a@b.com", "000000")).rejects.toMatchObject({
      status: 401,
      message: "That code is wrong or has expired.",
    });
    respond(401, { detail: "Not allowed" });
    await expect(requestCode("a@b.com")).rejects.toBeInstanceOf(ApiError);
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it("sends the email and code to the login endpoints", async () => {
    respond(202, { detail: "sent" });
    await requestCode("a@b.com");
    expect(lastRequest().url).toBe("/auth/request-code");
    expect(JSON.parse(lastRequest().data)).toEqual({ email: "a@b.com" });

    respond(200, { id: "1", email: "a@b.com" });
    await expect(verifyCode("a@b.com", "482913")).resolves.toEqual({
      id: "1",
      email: "a@b.com",
    });
    expect(lastRequest().url).toBe("/auth/verify-code");
    expect(JSON.parse(lastRequest().data)).toEqual({
      email: "a@b.com",
      code: "482913",
    });
  });

  it("rejects instead of redirecting when already on /login", async () => {
    window.history.pushState({}, "", "/login");
    respond(401, { detail: "Not authenticated" });
    await expect(getUser()).rejects.toBeInstanceOf(ApiError);
    expect(navigateTo).not.toHaveBeenCalled();
  });
});
