import { test, expect } from "@playwright/test";

test("login experience supports password visibility, theme preference and auth routes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Welcome Back." })).toBeVisible();
  await expect(page.locator(".login-photo-panel")).toBeVisible();
  const desktopPhoto = page.locator(".login-photo-panel img");
  await expect(desktopPhoto).toBeVisible();
  await expect.poll(() => desktopPhoto.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Email address")).toBeVisible();
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("type", "password");
  await expect(page.locator(".login-mobile-visual")).toBeVisible();

  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("html")).toHaveJSProperty("style.colorScheme", "dark");
  await expect(page.locator("#email")).toHaveCSS("background-color", "rgb(27, 25, 41)");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByRole("heading", { name: "Reset password" })).toBeVisible();

  await page.goto("/login");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
});

test("login shows non-enumerating credential and network errors", async ({ page }) => {
  await page.goto("/login?error=credentials");
  const errorMessage = page.locator(".login-error");
  await expect(errorMessage).toContainText("We couldn’t verify those details");
  await expect(errorMessage).not.toContainText("account not found");

  await page.goto("/login?error=network");
  await expect(page.locator(".login-error")).toContainText("couldn’t reach the sign-in service");
});
