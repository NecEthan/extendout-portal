import { deleteTeamMember, listTeam, updateTeamMember } from "@/lib/api/team";
import { ApiError } from "@/lib/api/apiError";
import { lastRequest, respond } from "@/test-utils/mockApi";

const member = {
  id: "u-1",
  email: "sam@example.com",
  name: "Sam",
  role: "builder" as const,
  project_ids: [7],
};

describe("team API", () => {
  it("asks the backend to search and filter, leaving out an empty search", async () => {
    const list = {
      members: [member],
      counts: { all: 1, admin: 0, builder: 1, client: 0 },
    };
    respond(200, list);
    await expect(
      listTeam({ search: "  sam ", role: "builder" })
    ).resolves.toEqual(list);
    expect(lastRequest().url).toBe("/team");
    expect(lastRequest().params).toEqual({ search: "sam", role: "builder" });

    respond(200, list);
    await listTeam({ search: "  ", role: "all" });
    expect(lastRequest().params).toEqual({ search: undefined, role: "all" });
  });

  it("sends only the changed fields when editing someone", async () => {
    respond(200, member);
    await expect(
      updateTeamMember("u-1", { name: "Sam", role: "client" })
    ).resolves.toEqual(member);
    const req = lastRequest();
    expect(req.method).toBe("patch");
    expect(req.url).toBe("/team/u-1");
    expect(JSON.parse(req.data)).toEqual({
      name: "Sam",
      role: "client",
    });
  });

  it("surfaces a taken email as an ApiError", async () => {
    respond(409, { detail: "Email already registered" });
    await expect(
      updateTeamMember("u-1", { email: "taken@example.com" })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("deletes someone", async () => {
    respond(204);
    await expect(deleteTeamMember("u-1")).resolves.toBeUndefined();
    const req = lastRequest();
    expect(req.method).toBe("delete");
    expect(req.url).toBe("/team/u-1");
  });
});
