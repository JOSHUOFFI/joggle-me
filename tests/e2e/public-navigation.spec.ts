import { test, expect } from "@playwright/test";

const appOrigin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

test("landing page presents the anonymous learning workspace entry point", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("JOGGLE ME").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Start Learning", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Start Learning", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const cookie = (await page.context().cookies()).find((item) => item.name === "joggle_workspace");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
});

test("materials upload requires a guest workspace capability", async ({ request }) => {
  const response = await request.post("/api/materials/upload", {
    headers: { Origin: appOrigin, "Content-Type": "text/plain", "X-File-Name": "notes.txt" },
    data: "study notes",
  });
  expect(response.status()).toBe(401);
});

test("quiz generation requires a guest workspace capability", async ({ request }) => {
  const response = await request.post("/api/quizzes/generate", {
    headers: { Origin: appOrigin, "Content-Type": "application/json" },
    data: {
      documentId: "20000000-0000-4000-8000-000000000031",
      questionCount: 5,
      difficulty: "easy",
      durationMinutes: 10,
      selectedTopics: ["Science"],
    },
  });
  expect(response.status()).toBe(401);
});

test("examination endpoints require a guest workspace capability", async ({ request }) => {
  const headers = { Origin: appOrigin, "Content-Type": "application/json" };
  const responses = await Promise.all([
    request.post("/api/exams/start", { headers, data: { quizId: "30000000-0000-4000-8000-000000000051" } }),
    request.post("/api/exams/40000000-0000-4000-8000-000000000051/answers", { headers, data: { answers: ["A", null] } }),
    request.post("/api/exams/40000000-0000-4000-8000-000000000051/submit", { headers, data: {} }),
  ]);
  expect(responses.map((response) => response.status())).toEqual([401, 401, 401]);
});
