import { ApiError } from "@/lib/api/client";
import { getUser } from "@/lib/api/auth";
import { createUser } from "@/lib/api/team";
import { lastRequest, networkError, respond } from "@/test-utils/mockApi";

const newUser = { email: "a@b.com", password: "pw", role: "builder" as const };

describe("api client", () => {
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
    respond(401, { detail: "Unauthorized" });
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
