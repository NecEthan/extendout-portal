import { type Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { DOCX_MIME, makeDocx } from "../utils/docx";

export class DocumentsPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/documents");
  }

  /** The document's title comes from the file name, so upload `<title>.docx`. */
  async uploadDocument(title: string, content: string) {
    await this.page.getByLabel("File").setInputFiles({
      name: `${title}.docx`,
      mimeType: DOCX_MIME,
      buffer: await makeDocx(content),
    });
    await this.page.getByRole("button", { name: /upload document/i }).click();
    await expect(this.page.getByText(title)).toBeVisible();
  }

  async openVersionHistory(docTitle: string) {
    const row = this.page
      .getByTestId("document-row")
      .filter({ hasText: docTitle });
    await row.getByRole("link", { name: /versions/i }).click();
  }

  async deleteDocument(docTitle: string) {
    const row = this.page
      .getByTestId("document-row")
      .filter({ hasText: docTitle });
    await row.getByRole("button", { name: /delete/i }).click();
  }

  async assertPageVisible() {
    await expect(this.page.getByText(/upload document/i).first()).toBeVisible();
    await expect(this.page.getByText(/your documents/i)).toBeVisible();
  }

  async assertUploadFormVisible() {
    await expect(this.page.getByLabel("File")).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: /upload document/i }),
    ).toBeVisible();
  }
}
