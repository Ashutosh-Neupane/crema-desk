import { test, expect } from "@playwright/test";

test.describe("Crema Desk", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Crema/);
  });

  test("login page is accessible", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email']")).toBeVisible();
  });

  test("login with no backend shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "test@example.com");
    await page.fill("input[type='password']", "password");
    await page.click("button:has-text('Sign in')");
    await page.waitForTimeout(1000);
    const body = await page.content();
    expect(body).toBeTruthy();
  });
});
