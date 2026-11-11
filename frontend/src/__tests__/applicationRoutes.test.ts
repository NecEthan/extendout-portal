import { applicationRoutes } from "@/utils/applicationRoutes";

describe("applicationRoutes", () => {
  it("builds a project route, optionally on a tab", () => {
    expect(applicationRoutes.project(7)).toBe("/projects/7");
    expect(applicationRoutes.project(7, "documents")).toBe(
      "/projects/7?tab=documents"
    );
    expect(applicationRoutes.project("7", "photos")).toBe(
      "/projects/7?tab=photos"
    );
  });

  it("builds a document's version history route", () => {
    expect(applicationRoutes.documentVersions("abc")).toBe(
      "/documents/abc/versions"
    );
    expect(applicationRoutes.documentVersions("abc", 7)).toBe(
      "/documents/abc/versions?project=7"
    );
    expect(applicationRoutes.documentVersions("abc", null)).toBe(
      "/documents/abc/versions"
    );
  });

  it("encodes ids so they can't change the path", () => {
    expect(applicationRoutes.project("1/../team")).toBe(
      "/projects/1%2F..%2Fteam"
    );
    expect(applicationRoutes.documentVersions("a b", "x&y")).toBe(
      "/documents/a%20b/versions?project=x%26y"
    );
  });
});
