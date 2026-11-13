import { test, expect } from "@playwright/test";
import { LoginPage } from "../pom/LoginPage";
import { E2E_EMAIL } from "../utils/env";
import { latestLoginCode } from "../utils/loginCode";

test.describe("Auth flow", () => {
  test("unauthenticated root redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated project page redirects to /login", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page asks for an email, not a password", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(loginPage.emailInput()).toBeVisible();
    await expect(loginPage.sendCodeButton()).toBeVisible();
    await expect(page.getByLabel(/password/i)).toHaveCount(0);
  });

  test("wrong code shows error", async ({ page, request }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.requestCode(E2E_EMAIL);
    const code = await latestLoginCode(request, E2E_EMAIL);
    await loginPage.enterCode(code === "000000" ? "111111" : "000000");
    // Filter by text: Next.js adds its own (empty) role="alert" route announcer.
    await expect(
      page.getByRole("alert").filter({ hasText: /wrong or has expired/ })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("valid code lands on the dashboard, sign out returns to /login", async ({
    page,
    request,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.requestCode(E2E_EMAIL);
    await loginPage.enterCode(await latestLoginCode(request, E2E_EMAIL));
    await expect(page).toHaveURL(/\/dashboard/);

    // Already logged in: /login sends you back to the dashboard.
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard/);

    await loginPage.signOut();
    await expect(page).toHaveURL(/\/login/);
  });
});
