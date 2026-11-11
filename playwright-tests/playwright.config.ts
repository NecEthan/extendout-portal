import { defineConfig, devices } from "@playwright/test";

// PLAYWRIGHT_CHANNEL=chrome uses the installed Google Chrome instead of
// Playwright's own Chromium. CI sets it: GitHub's runners already have Chrome,
// and installing Chromium's system libraries via apt can hang there.
const desktopChrome = {
  ...devices["Desktop Chrome"],
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
};

export default defineConfig({
  testDir: ".",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    // Top level so every project uses it, including "setup" (which has no
    // `use` of its own).
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  projects: [
    {
      name: "setup",
      testMatch: /utils\/auth\.setup\.ts/,
    },
    {
      name: "unauthenticated",
      testMatch: /auth\/.+\.spec\.ts/,
      use: desktopChrome,
      dependencies: ["setup"],
    },
    {
      name: "authenticated",
      testMatch: /(documents|photos)\/.+\.spec\.ts/,
      use: {
        ...desktopChrome,
        storageState: ".auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "search",
      testMatch: /search\/.+\.spec\.ts/,
      use: {
        ...desktopChrome,
        storageState: ".auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "versions",
      testMatch: /versions\/.+\.spec\.ts/,
      use: {
        ...desktopChrome,
        storageState: ".auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev",
    cwd: "../frontend",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
