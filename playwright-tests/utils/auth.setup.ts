import { test as setup, expect } from "@playwright/test";
import fs from "fs";

// There is no public sign-up: an admin creates the E2E user through POST /team.
// Point these at an existing admin in the database under test.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "test@gmail.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "password";

const EMAIL = "e2e@example.com";
const PASSWORD = "Password123";
const API = "http://localhost:8000";

setup("seed and authenticate", async ({ page, request }) => {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!login.ok()) throw new Error(`admin login failed: ${login.status()}`);

  const created = await request.post(`${API}/team`, {
    data: { email: EMAIL, password: PASSWORD, role: "builder", name: "E2E" },
  });
  if (!created.ok() && created.status() !== 409) {
    throw new Error(`seed failed: ${created.status()}`);
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  fs.mkdirSync(".auth", { recursive: true });
  await page.context().storageState({ path: ".auth/user.json" });
});
