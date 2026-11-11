import { test, expect } from "@playwright/test";
import { ProjectPage } from "../pom/ProjectPage";
import { VersionHistoryPage } from "../pom/VersionHistoryPage";
import { e2eProjectId, unique } from "../utils/env";

test.describe("Version history", () => {
  test("shows the uploaded document's first version", async ({ page }) => {
    const project = new ProjectPage(page, e2eProjectId());
    const history = new VersionHistoryPage(page);
    const title = unique("E2E versioned");

    await project.goto("documents");
    await project.uploadDocument(title, `v1 of ${title}`);
    await project.openVersions(title);

    await history.assertLoaded();
    await expect(history.versionRows()).toHaveCount(1);
    await expect(history.versionRows().first()).toContainText("v1");
  });

  test("a new version appears above the old one", async ({ page }) => {
    const project = new ProjectPage(page, e2eProjectId());
    const history = new VersionHistoryPage(page);
    const title = unique("E2E multi-version");

    await project.goto("documents");
    await project.uploadDocument(title, `v1 of ${title}`);
    await project.openVersions(title);
    await history.assertLoaded();

    await history.uploadNewVersion("v2.docx", `v2 of ${title}`);

    await expect(history.versionRows()).toHaveCount(2);
    await expect(history.versionRows().first()).toContainText("v2");
    await expect(history.versionRows().nth(1)).toContainText("v1");
  });

  test("back to documents returns to the project's documents tab", async ({
    page,
  }) => {
    const project = new ProjectPage(page, e2eProjectId());
    const history = new VersionHistoryPage(page);
    const title = unique("E2E back nav");

    await project.goto("documents");
    await project.uploadDocument(title, `Content for ${title}`);
    await project.openVersions(title);
    await history.assertLoaded();

    await history.goBackToDocuments();
    await expect(page).toHaveURL(
      new RegExp(`/projects/${e2eProjectId()}\\?tab=documents`)
    );
  });

  test("an older version can be set as active", async ({ page }) => {
    test.slow(); // waits for the worker to process two versions
    const project = new ProjectPage(page, e2eProjectId());
    const history = new VersionHistoryPage(page);
    const title = unique("E2E activate");

    await project.goto("documents");
    await project.uploadDocument(title, `v1 of ${title}`);
    await project.openVersions(title);
    await history.assertLoaded();
    await history.waitForVersionStatus(1, "ACTIVE");

    await history.uploadNewVersion("v2.docx", `v2 of ${title}`);
    await history.waitForVersionStatus(2, "ACTIVE");
    await history.waitForVersionStatus(1, "SUPERSEDED");

    await history.clickSetAsActive(1);

    await history.waitForVersionStatus(1, "ACTIVE");
    await history.waitForVersionStatus(2, "SUPERSEDED");
  });
});
