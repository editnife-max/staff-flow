import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    // Wait for networkidle so React is fully hydrated before interacting
    await page.goto("/login", { waitUntil: "networkidle" });
  });

  test("renders sign-in form with email and password fields", async ({ page }) => {
    // CardTitle renders as a div in shadcn, not a heading element
    await expect(page.getByText("Sign in").first()).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
  });

  test("invalid credentials keep user on login page", async ({ page }) => {
    await page.locator("#email").fill("definitely-no-such-user@test.example.com");
    await page.locator("#password").fill("wrongpassword123");

    // Capture the Supabase auth request to confirm React is handling the submit
    const authRequest = page.waitForRequest(
      (req) => req.url().includes("/auth/v1/token") && req.method() === "POST",
      { timeout: 8_000 },
    );

    await page.getByRole("button", { name: /^sign in$/i }).click();

    // Confirm the Supabase auth request was fired (not native browser form submit)
    await authRequest;

    // Wait for the button to re-enable (request completed with error response)
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeEnabled({ timeout: 15_000 });

    // User should remain on /login after a failed attempt
    await expect(page).toHaveURL("/login");
  });

  test("submit button is disabled while sign-in request is pending", async ({ page }) => {
    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("password123");

    // Delay the Supabase auth token request to observe the transient loading state
    await page.route(
      (url) => url.hostname.endsWith(".supabase.co") && url.pathname.includes("/auth/v1/token"),
      (route) => setTimeout(() => route.abort(), 4_000),
    );

    await page.getByRole("button", { name: /^sign in$/i }).click();

    // When submitting=true the button text changes to "Signing in..." and becomes disabled.
    // Locate by type rather than name since the accessible name changes.
    const submitBtn = page.locator("button[type='submit']");
    await expect(submitBtn).toBeDisabled({ timeout: 3_000 });
    await expect(submitBtn).toContainText(/signing in/i);
  });

  test("Logo link returns to landing page", async ({ page }) => {
    await page.getByRole("link", { name: /staff-flow/i }).click();
    await expect(page).toHaveURL("/");
  });
});

test.describe("Auth guard", () => {
  test("visiting /dashboard without auth redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    // Auth check is client-side (Supabase session), allow generous time for hydration + redirect
    await page.waitForURL("**/login", { timeout: 20_000 });
  });

  test("visiting /manager/dashboard without auth redirects to /login", async ({ page }) => {
    await page.goto("/manager/dashboard");
    await page.waitForURL("**/login", { timeout: 20_000 });
  });

  test("visiting /staff/dashboard without auth redirects to /login", async ({ page }) => {
    await page.goto("/staff/dashboard");
    await page.waitForURL("**/login", { timeout: 20_000 });
  });
});
