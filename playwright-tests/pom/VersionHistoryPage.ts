import { type Page, type Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { DOCX_MIME, makeDocx } from "../utils/docx";

export class VersionHistoryPage {
  constructor(private readonly page: Page) {}

  async assertLoaded() {
    await expect(this.page.getByText(/version history/i)).toBeVisible();
  }

  versionRows(): Locator {
    return this.page.getByTestId("version-row");
  }

  async uploadNewVersion(filename: string, content: string) {
    await this.page.getByLabel("File").setInputFiles({
      name: filename,
      mimeType: DOCX_MIME,
      buffer: await makeDocx(content),
    });
    await this.page
      .getByRole("button", { name: /upload new version/i })
      .click();
  }

  async goBackToDocuments() {
    await this.page
      .getByRole("button", { name: /back to documents/i })
      .click();
  }

  /** Waits for the worker: the page refreshes the list while versions process. */
  async waitForVersionStatus(versionNumber: number, status: string) {
    await expect(
      this.page
        .getByTestId("version-row")
        .filter({ hasText: `v${versionNumber}` })
        .getByTestId("version-status")
    ).toHaveText(status, { timeout: 60_000 });
  }

  async clickSetAsActive(versionNumber: number) {
    await this.page
      .getByTestId("version-row")
      .filter({ hasText: `v${versionNumber}` })
      .getByRole("button", { name: /set as active/i })
      .click();
  }
}
