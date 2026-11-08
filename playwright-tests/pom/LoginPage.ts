import { type Page } from "@playwright/test";

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.page.getByLabel("Email").fill(email);
    await this.page.getByLabel("Password", { exact: true }).fill(password);
    await this.page.getByRole("button", { name: /sign in/i }).click();
  }

  async signOut() {
    await this.page.getByRole("button", { name: /sign out/i }).click();
  }

  emailInput() {
    return this.page.getByLabel("Email");
  }

  passwordInput() {
    return this.page.getByLabel("Password", { exact: true });
  }

  signInButton() {
    return this.page.getByRole("button", { name: /sign in/i });
  }
}
