import fs from "fs";

export const API = "http://localhost:8000";

/** The builder every authenticated spec runs as (created by auth.setup.ts).
 * There are no passwords: specs log in with the code from the dev outbox. */
export const E2E_EMAIL = "e2e@example.com";

/** Written by auth.setup.ts: the project created for this run. */
export const PROJECT_FILE = ".auth/project.json";

export function e2eProjectId(): number {
  return JSON.parse(fs.readFileSync(PROJECT_FILE, "utf8")).id;
}

/** Unique text, so uploads never collide with the duplicate-content check. */
export function unique(label: string): string {
  return `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
