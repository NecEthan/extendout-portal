import { test, expect } from "@playwright/test";
import { LoginPage } from "../pom/LoginPage";
import { E2E_EMAIL, E2E_PASSWORD } from "../utils/env";

test.describe("Auth flow", () => {
  test("unauthenticated root redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated project page redirects to /login", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page renders sign in form", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(loginPage.emailInput()).toBeVisible();
    await expect(loginPage.passwordInput()).toBeVisible();
    await expect(loginPage.signInButton()).toBeVisible();
  });

  test("wrong password shows error", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(E2E_EMAIL, "WrongPassword1");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("valid login lands on the dashboard, sign out returns to /login", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(E2E_EMAIL, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/dashboard/);

    await loginPage.signOut();
    await expect(page).toHaveURL(/\/login/);
  });
});
