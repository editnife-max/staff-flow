import { defineConfig, devices } from "@playwright/test";
import path from "path";

const MANAGER_AUTH_FILE = path.join(import.meta.dirname, "tests/e2e/.auth/manager.json");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // ── 1. Auth setup — runs once, saves session to disk ──────────────────
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },

    // ── 2. Tests that don't need auth — run immediately in parallel ────────
    {
      name: "chromium-public",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /public\.spec\.ts/,
    },

    // ── 3. Auth tests — unauthenticated flows, no saved state needed ───────
    {
      name: "chromium-auth",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /auth\.spec\.ts/,
    },

    // ── 4. Manager tests — depend on setup, load saved session ────────────
    {
      name: "chromium-manager",
      use: {
        ...devices["Desktop Chrome"],
        storageState: MANAGER_AUTH_FILE,
      },
      testMatch: /manager\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "C:\\Users\\VICTUS\\.bun\\bin\\bun.exe dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
