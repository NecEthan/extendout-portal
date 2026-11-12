import { apiRoutes } from "@/lib/api/apiRoutes";

describe("apiRoutes", () => {
  it("builds nested endpoint paths", () => {
    expect(apiRoutes.auth.login).toBe("/auth/login");
    expect(apiRoutes.team.member("u-1")).toBe("/team/u-1");
    expect(apiRoutes.projects.project(7)).toBe("/projects/7");
    expect(apiRoutes.projects.member(7, "u-1")).toBe("/projects/7/members/u-1");
    expect(apiRoutes.projects.photoFile(7, "p-1")).toBe(
      "/projects/7/photos/p-1/file"
    );
    expect(apiRoutes.documents.activateVersion("d-1", "v-2")).toBe(
      "/documents/d-1/versions/v-2/activate"
    );
  });

  it("encodes ids so they can't change the path", () => {
    expect(apiRoutes.team.member("../auth/logout")).toBe(
      "/team/..%2Fauth%2Flogout"
    );
    expect(apiRoutes.projects.photo("1/x", "a?b")).toBe(
      "/projects/1%2Fx/photos/a%3Fb"
    );
    expect(apiRoutes.documents.document("a b")).toBe("/documents/a%20b");
  });
});
