import { test, expect } from "@playwright/test";
import { ProjectPage } from "../pom/ProjectPage";
import { e2eProjectId, unique } from "../utils/env";

test.describe("Project documents", () => {
  test("documents tab shows the upload form and list", async ({ page }) => {
    const project = new ProjectPage(page, e2eProjectId());
    await project.goto("documents");
    await expect(page.getByLabel("File")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Upload document" }),
    ).toBeVisible();
    await expect(page.getByText("Project documents")).toBeVisible();
  });

  test("upload a document and see it in the list", async ({ page }) => {
    const project = new ProjectPage(page, e2eProjectId());
    const title = unique("E2E upload");

    await project.goto("documents");
    await project.uploadDocument(title, `Content for ${title}`);

    await expect(project.documentRow(title)).toBeVisible();
  });

  test("delete a document removes it from the list", async ({ page }) => {
    const project = new ProjectPage(page, e2eProjectId());
    const title = unique("E2E delete");

    await project.goto("documents");
    await project.uploadDocument(title, `Content for ${title}`);
    await project.deleteDocument(title);

    await expect(project.documentRow(title)).toHaveCount(0);
  });

  test("preview a PDF on the documents tab", async ({ page }) => {
    const project = new ProjectPage(page, e2eProjectId());
    const title = unique("E2E preview pdf");

    await project.goto("documents");
    await project.uploadPdf(title, `Drawing notes for ${title}`);

    const preview = await project.openPreview(title);
    await expect(preview.getByText("1 page")).toBeVisible({ timeout: 20_000 });
    await expect(preview.getByRole("img", { name: "Page 1" })).toBeVisible();

    await preview.getByRole("button", { name: "Close preview" }).click();
    await expect(preview).toBeHidden();
    await expect(page).toHaveURL(/tab=documents/);
  });

  test("preview a Word document on the documents tab", async ({ page }) => {
    const project = new ProjectPage(page, e2eProjectId());
    const title = unique("E2E preview docx");

    await project.goto("documents");
    await project.uploadDocument(title, `Loft spec for ${title}`);

    const preview = await project.openPreview(title);
    await expect(preview.getByText(`Loft spec for ${title}`)).toBeVisible({
      timeout: 20_000,
    });
    await page.keyboard.press("Escape");
    await expect(preview).toBeHidden();
  });
});
