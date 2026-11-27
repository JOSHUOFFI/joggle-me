import { test, expect } from "@playwright/test";

test("premium landing page exposes real learning routes and responsive sections", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Learn. Challenge Yourself. Level Up." })).toBeVisible();
  const mainNavigation = page.getByRole("navigation", { name: "Main navigation" });
  for (const label of ["Home", "Features", "How It Works", "Community", "About"]) {
    await expect(mainNavigation.getByRole("link", { name: label })).toBeVisible();
  }
  for (const [label, anchor] of [["Home", "home"], ["Features", "features"], ["How It Works", "how-it-works"], ["About", "about"]]) {
    await mainNavigation.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`#${anchor}$`));
  }
  await expect(page.getByText("Powered by JoLight Technologies.", { exact: true })).toBeVisible();

  for (const alt of ["Adult learner focused on a laptop in a calm, modern workspace", "A diverse group of adult learners sharing ideas around a laptop"]) {
    const photo = page.getByRole("img", { name: alt });
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate((image) => image instanceof HTMLImageElement ? image.naturalWidth : 0)).toBeGreaterThan(0);
  }

  await page.getByRole("link", { name: "Explore Features" }).click();
  await expect(page).toHaveURL(/#features$/);
  await expect(page.getByRole("heading", { name: "AI-Powered Learning" })).toBeVisible();

  await page.getByRole("link", { name: "Start Learning", exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);

  await page.goto("/");
  await page.getByRole("link", { name: "Get Started", exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test("theme control switches the landing page between light and dark palettes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("joggle-theme"));
  await page.reload();

  const pageSurface = page.locator("main[data-landing-page]");
  const lightBackground = await pageSurface.evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect.poll(() => pageSurface.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(lightBackground);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("joggle-theme"))).toBe("dark");

  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("joggle-theme"))).toBe("light");
});

test("mobile navigation is usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const menu = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(menu.getByRole("link", { name: "How It Works" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const reopenedMenu = page.getByRole("navigation", { name: "Mobile navigation" });
  await reopenedMenu.getByRole("link", { name: "Features" }).click();
  await expect(page).toHaveURL(/#features$/);
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeVisible();

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow, `no horizontal overflow at ${width}px`).toBe(false);
  }
});

test("landing navbar sticks, adopts its glass state, and tracks the active section", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const header = page.locator("header.landing-header");
  await expect(header).toHaveCSS("position", "sticky");
  await expect(header).not.toHaveClass(/is-scrolled/);

  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(header).toHaveClass(/is-scrolled/);
  await expect(header).toHaveCSS("top", "0px");
  await expect.poll(() => header.evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBe(0);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Features" })).toHaveAttribute("aria-current", "location");

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(header).not.toHaveClass(/is-scrolled/);
});

test("community and dashboard calls to action use the existing protected platform routes", async ({ page }) => {
  await page.goto("/");
  await page.locator("header").getByRole("link", { name: "Community" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");
  await page.getByRole("link", { name: "Explore Community" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");
  await page.getByRole("link", { name: "Explore Dashboard" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("landing content remains visible with reduced motion enabled", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your Learning Journey, Made Simple" })).toBeVisible();
  const animationDuration = await page.locator(".hero-photo").evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(animationDuration)).toBeLessThanOrEqual(0.001);
});
