import { expect, type Locator, type Page } from "@playwright/test";
import { DOCX_MIME, makeDocx } from "../utils/docx";
import { TINY_PNG } from "../utils/png";

type Tab = "overview" | "photos" | "documents" | "search";

/** A project's page and its Documents / Search / Photos tabs. */
export class ProjectPage {
  constructor(
    private readonly page: Page,
    private readonly projectId: number
  ) {}

  async goto(tab: Tab) {
    await this.page.goto(`/projects/${this.projectId}?tab=${tab}`);
  }

  // ── Documents ──────────────────────────────────────────────────────────────

  documentRow(title: string): Locator {
    return this.page.getByTestId("document-row").filter({ hasText: title });
  }

  /** The document's title comes from the file name, so upload `<title>.docx`. */
  async uploadDocument(title: string, content: string) {
    await this.page.getByLabel("File").setInputFiles({
      name: `${title}.docx`,
      mimeType: DOCX_MIME,
      buffer: await makeDocx(content),
    });
    await this.page.getByRole("button", { name: "Upload document" }).click();
    await expect(this.documentRow(title)).toBeVisible();
  }

  async deleteDocument(title: string) {
    await this.documentRow(title).getByRole("button", { name: "Delete" }).click();
  }

  async openVersions(title: string) {
    await this.documentRow(title).getByRole("button", { name: "Versions" }).click();
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  questionInput(): Locator {
    return this.page.getByLabel("Question");
  }

  searchButton(): Locator {
    return this.page.getByRole("button", { name: "Search" });
  }

  async search(question: string) {
    await this.questionInput().fill(question);
    await this.searchButton().click();
  }

  // ── Photos ─────────────────────────────────────────────────────────────────

  async uploadPhoto(description: string) {
    await this.page.getByLabel("Photo").setInputFiles({
      name: "site.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await this.page.getByLabel("Description (optional)").fill(description);
    await this.page.getByRole("button", { name: "Upload photo" }).click();
  }

  photo(description: string): Locator {
    return this.page.getByRole("img", { name: description });
  }

  async deletePhoto(description: string) {
    this.page.once("dialog", (dialog) => dialog.accept());
    await this.page
      .getByRole("button", { name: `Delete ${description}` })
      .click();
  }
}
