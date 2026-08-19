import { test, expect } from "@playwright/test";

const HAS_CREDS = !!(process.env.E2E_MANAGER_EMAIL && process.env.E2E_MANAGER_PASSWORD);

// storageState is loaded at the project level (playwright.config.ts).
// Tests start already authenticated — no login flow needed per test.
test.describe("Manager dashboard", () => {
  test.skip(!HAS_CREDS, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD to run authenticated tests");

  test.beforeEach(async ({ page }) => {
    // Suppress the Upcoming Flights auto-dialog before the dashboard loads.
    // Setting sessionStorage on the about:blank page (same origin after goto)
    // doesn't work, so we navigate first then reload if needed.
    // Instead: intercept the navigation to inject sessionStorage mid-load.
    await page.addInitScript(() => {
      const todayKey = new Date().toISOString().slice(0, 10);
      try { sessionStorage.setItem("flight-reminder-dismissed", todayKey); } catch {}
    });

    await page.goto("/manager/dashboard");

    // Wait for any success/welcome toast to clear before each test
    await page
      .waitForFunction(() => document.querySelectorAll("[data-sonner-toast]").length === 0, { timeout: 8_000 })
      .catch(() => {});
  });

  test("lands on manager dashboard", async ({ page }) => {
    await expect(page).toHaveURL(/\/manager\/dashboard/);
    await expect(page.getByText(/staff-flow/i).first()).toBeVisible();
  });

  test("manager nav contains all expected links", async ({ page }) => {
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: /dashboard/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^staff$/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^candidates$/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /foreign agencies/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /subscription/i })).toBeVisible();
  });

  test("navigates to candidates page and shows search and tabs", async ({ page }) => {
    // Use exact name to avoid strict-mode conflict with the "Manage Candidates" shortcut button
    await page.getByRole("link", { name: "Candidates", exact: true }).click();
    await page.waitForURL("**/manager/candidates*");

    // The main search input placeholder
    await expect(page.getByPlaceholder(/name, labour/i)).toBeVisible();

    // Status tabs
    await expect(page.getByText("Available").first()).toBeVisible();
    await expect(page.getByText("Processing").first()).toBeVisible();
  });

  test("logout returns user to login page", async ({ page }) => {
    // Open the user avatar dropdown (button contains the ChevronDown icon)
    await page.locator("button").filter({ has: page.locator(".lucide-chevron-down") }).last().click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await expect(page).toHaveURL("/login", { timeout: 10_000 });
  });
});
