import { test, expect } from "@playwright/test";

test("learner dashboard and material library require an authenticated learner", async ({ page }) => {
  for (const route of ["/dashboard", "/dashboard/materials"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }
});
