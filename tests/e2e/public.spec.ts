import { test, expect } from "@playwright/test";

test.describe("Public pages", () => {
  test("landing page loads with hero heading and CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Staff-Flow");
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
  });

  test("landing page nav links are visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /about/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /faq/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /contact/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /login/i })).toBeVisible();
  });

  test("clicking Login navigates to /login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /login/i }).click();
    await expect(page).toHaveURL("/login");
  });

  test("about page loads", async ({ page }) => {
    await page.goto("/about");
    await expect(page).toHaveURL("/about");
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("faq page loads", async ({ page }) => {
    await page.goto("/faq");
    await expect(page).toHaveURL("/faq");
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("contact page loads", async ({ page }) => {
    await page.goto("/contact");
    await expect(page).toHaveURL("/contact");
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
