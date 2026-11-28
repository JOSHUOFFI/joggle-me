import { test, expect } from "@playwright/test";

test("learner dashboard and material library start an anonymous guest workspace", async ({ page }) => {
  for (const route of ["/dashboard", "/dashboard/materials"]) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route.replaceAll("/", "\\/")}$`));
    await expect(page.context().cookies()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "joggle_workspace", httpOnly: true }),
      ]),
    );
  }
});

test("guest workspace capabilities keep settings isolated between browsers", async ({ browser }) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  try {
    const firstPage = await firstContext.newPage();
    await firstPage.goto("/dashboard");
    await firstPage.goto("/profile");
    await expect(firstPage).toHaveURL(/\/profile$/);
    await firstPage.getByLabel("Display name").fill("Workspace One");
    await firstPage.getByRole("button", { name: "Save settings" }).click();
    await expect(firstPage.getByText("Workspace settings updated.")).toBeVisible();

    const secondPage = await secondContext.newPage();
    await secondPage.goto("/dashboard");
    await secondPage.goto("/profile");
    await expect(secondPage).toHaveURL(/\/profile$/);
    await expect(secondPage.getByLabel("Display name")).toHaveValue("Learner");

    const firstToken = (await firstContext.cookies()).find((cookie) => cookie.name === "joggle_workspace")?.value;
    const secondToken = (await secondContext.cookies()).find((cookie) => cookie.name === "joggle_workspace")?.value;
    expect(firstToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(secondToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(firstToken).not.toBe(secondToken);
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});
