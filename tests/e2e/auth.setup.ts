import { test as setup, expect } from "@playwright/test";
import path from "path";

export const MANAGER_AUTH_FILE = path.join(import.meta.dirname, ".auth/manager.json");

const EMAIL = process.env.E2E_MANAGER_EMAIL ?? "";
const PASSWORD = process.env.E2E_MANAGER_PASSWORD ?? "";

setup("authenticate as manager", async ({ page }) => {
  if (!EMAIL || !PASSWORD) {
    // Write an empty state file so dependent projects don't crash
    await page.context().storageState({ path: MANAGER_AUTH_FILE });
    return;
  }

  await page.goto("/login", { waitUntil: "networkidle" });

  // Suppress the Upcoming Flights auto-dialog before the dashboard loads
  const todayKey = new Date().toISOString().slice(0, 10);
  await page.evaluate((key) => {
    try { sessionStorage.setItem("flight-reminder-dismissed", key); } catch {}
  }, todayKey);

  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/manager/dashboard", { timeout: 15_000 });

  // Confirm we are actually on the dashboard (not stuck on login)
  await expect(page).toHaveURL(/\/manager\/dashboard/);

  // Save cookies + localStorage — all manager tests will load this instead of logging in
  await page.context().storageState({ path: MANAGER_AUTH_FILE });
});
