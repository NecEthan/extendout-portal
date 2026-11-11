import { test, expect } from "@playwright/test";
import { ProjectPage } from "../pom/ProjectPage";
import { e2eProjectId, unique } from "../utils/env";

test.describe("Site photos", () => {
  test("upload a photo, see it, then delete it", async ({ page }) => {
    const project = new ProjectPage(page, e2eProjectId());
    const description = unique("E2E photo");

    await project.goto("photos");
    await project.uploadPhoto(description);
    await expect(project.photo(description)).toBeVisible();

    await project.deletePhoto(description);
    await expect(project.photo(description)).toHaveCount(0);
  });
});
