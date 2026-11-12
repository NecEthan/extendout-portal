import { apiRoutes } from "@/lib/api/apiRoutes";

describe("apiRoutes", () => {
  it("builds nested endpoint paths", () => {
    expect(apiRoutes.project(7)).toBe("/projects/7");
    expect(apiRoutes.projectMember(7, "u-1")).toBe("/projects/7/members/u-1");
    expect(apiRoutes.projectPhotoFile(7, "p-1")).toBe(
      "/projects/7/photos/p-1/file"
    );
    expect(apiRoutes.activateDocumentVersion("d-1", "v-2")).toBe(
      "/documents/d-1/versions/v-2/activate"
    );
    expect(apiRoutes.teamMember("u-1")).toBe("/team/u-1");
  });

  it("encodes ids so they can't change the path", () => {
    expect(apiRoutes.teamMember("../auth/logout")).toBe(
      "/team/..%2Fauth%2Flogout"
    );
    expect(apiRoutes.projectPhoto("1/x", "a?b")).toBe(
      "/projects/1%2Fx/photos/a%3Fb"
    );
    expect(apiRoutes.document("a b")).toBe("/documents/a%20b");
  });
});
