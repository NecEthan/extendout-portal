import { test, expect } from "@playwright/test";
import { ProjectPage } from "../pom/ProjectPage";
import { MOCK_QUERY_RESPONSE, mockQueryRoute } from "../mocks/query";
import { e2eProjectId } from "../utils/env";

test.describe("Project search", () => {
  test("search button is disabled until a question is typed", async ({ page }) => {
    const project = new ProjectPage(page, e2eProjectId());
    await project.goto("search");

    await expect(page.getByText("Ask a question")).toBeVisible();
    await expect(project.searchButton()).toBeDisabled();
    await project.questionInput().fill("a question");
    await expect(project.searchButton()).toBeEnabled();
  });

  test("shows the answer and its sources", async ({ page }) => {
    const project = new ProjectPage(page, e2eProjectId());
    await mockQueryRoute(page);
    await project.goto("search");

    await project.search("What documents are available?");

    await expect(page.getByText(MOCK_QUERY_RESPONSE.answer)).toBeVisible();
    await expect(page.getByText("Sources")).toBeVisible();
    await expect(
      page.getByText(MOCK_QUERY_RESPONSE.citations[0].document_title)
    ).toBeVisible();
    await expect(page.getByText(/Version 1/)).toBeVisible();
  });

  test("sends the project id with the question", async ({ page }) => {
    const project = new ProjectPage(page, e2eProjectId());
    await mockQueryRoute(page);
    await project.goto("search");

    const request = page.waitForRequest(
      (r) => r.url().endsWith("/query") && r.method() === "POST"
    );
    await project.search("Which drawings are current?");
    expect((await request).postDataJSON()).toEqual({
      question: "Which drawings are current?",
      project_id: e2eProjectId(),
    });
  });
});
