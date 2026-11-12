import { test as setup, expect, type APIRequestContext } from "@playwright/test";
import fs from "fs";
import { API, E2E_EMAIL, E2E_PASSWORD, PROJECT_FILE } from "./env";

// There is no public sign-up: an admin creates the E2E user and a project
// through the API. Point these at an existing admin in the database under test
// (CI creates test@gmail.com / password in .github/workflows/ci.yml).
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "test@gmail.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "password";

async function ok(res: Awaited<ReturnType<APIRequestContext["get"]>>, what: string) {
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`${what} failed: ${res.status()} ${body}`);
  }
  return res.json();
}

setup("seed and authenticate", async ({ page, request }) => {
  await ok(
    await request.post(`${API}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    }),
    "admin login"
  );

  // The E2E builder (created once; 409 means it already exists).
  const created = await request.post(`${API}/team`, {
    data: { email: E2E_EMAIL, password: E2E_PASSWORD, role: "builder", name: "E2E Builder" },
  });
  if (!created.ok() && created.status() !== 409) {
    throw new Error(`create user failed: ${created.status()}`);
  }
  const team: { id: string; email: string }[] = await ok(
    await request.get(`${API}/team`),
    "list team"
  );
  const builder = team.find((m) => m.email === E2E_EMAIL);
  if (!builder) throw new Error("E2E builder not found after creating it");

  // A fresh project per run, with the builder as a member, so specs never
  // see another run's documents or photos.
  const project: { id: number } = await ok(
    await request.post(`${API}/projects`, {
      data: { name: `E2E project ${Date.now()}`, client: "E2E", address: "" },
    }),
    "create project"
  );
  await ok(
    await request.post(`${API}/projects/${project.id}/members`, {
      data: { user_id: builder.id },
    }),
    "add member"
  );

  // Sign the builder in through the UI and save the session for the specs.
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  fs.mkdirSync(".auth", { recursive: true });
  await page.context().storageState({ path: ".auth/user.json" });
  fs.writeFileSync(PROJECT_FILE, JSON.stringify({ id: project.id }));
});
