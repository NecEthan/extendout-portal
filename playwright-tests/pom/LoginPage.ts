import { expect, type Page } from "@playwright/test";

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/login");
  }

  /** Step 1: enter the email and ask for a code. */
  async requestCode(email: string) {
    await this.emailInput().fill(email);
    await this.sendCodeButton().click();
    await expect(this.codeInput()).toBeVisible();
  }

  /** Step 2: enter the emailed code and sign in. */
  async enterCode(code: string) {
    await this.codeInput().fill(code);
    await this.signInButton().click();
  }

  async signOut() {
    await this.page.getByRole("button", { name: /sign out/i }).click();
  }

  emailInput() {
    return this.page.getByLabel("Email");
  }

  sendCodeButton() {
    return this.page.getByRole("button", { name: "Send code" });
  }

  codeInput() {
    return this.page.getByLabel("Code");
  }

  signInButton() {
    return this.page.getByRole("button", { name: "Sign in" });
  }
}
