import { test, expect } from "@playwright/test";

const appOrigin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

test("landing page presents JOGGLE ME and authentication entry points", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("JOGGLE ME").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Start Learning", exact: true })).toBeVisible();
  await expect(page.locator("header").getByRole("link", { name: "Log in", exact: true })).toBeVisible();
});

test("registration form exposes required account fields", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByLabel("First name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});

test("community routes require an authenticated learner", async ({ page }) => {
  for (const route of [
    "/dashboard/community",
    "/dashboard/community/questions",
    "/dashboard/community/groups",
    "/dashboard/community/activity",
    "/dashboard/community/profile",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("owner community controls require platform authorization", async ({ page }) => {
  await page.goto("/owner/community");
  await expect(page).toHaveURL(/\/login$/);
});

test("login links to the neutral password recovery request page", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();

  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByRole("heading", { name: "Reset password" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();

  await page.getByLabel("Email").fill("not-registered@example.invalid");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "If that email is registered, you’ll receive a password reset link shortly.",
  );
});

test("invalid recovery links show a clear error instead of the password form", async ({ page }) => {
  await page.goto("/auth/callback?code=invalid-code&next=/update-password");

  await expect(page).toHaveURL(/\/update-password\?error=link$/);
  await expect(page.locator("p[role='alert']")).toContainText(
    "This password reset link is invalid, expired, or has already been used.",
  );
  await expect(page.getByRole("link", { name: "Request a new reset link" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Update password" })).toHaveCount(0);
});

test("materials upload endpoint rejects unauthenticated uploads", async ({ request }) => {
  const response = await request.post("/api/materials/upload", {
    headers: {
      Origin: appOrigin,
      "Content-Type": "text/plain",
      "X-File-Name": "notes.txt",
    },
    data: "study notes",
  });

  const body = await response.json();
  expect(response.status(), body.message).toBe(401);
  expect(body.message).toContain("Log in");
});

test("quiz generation endpoint rejects unauthenticated requests", async ({ request }) => {
  const response = await request.post("/api/quizzes/generate", {
    headers: {
      Origin: appOrigin,
      "Content-Type": "application/json",
    },
    data: {
      documentId: "20000000-0000-4000-8000-000000000031",
      questionCount: 5,
      difficulty: "easy",
      durationMinutes: 10,
      selectedTopics: ["Science"],
    },
  });

  const body = await response.json();
  expect(response.status(), body.message).toBe(401);
  expect(body.message).toContain("Log in");
});

test("examination start endpoint rejects unauthenticated requests", async ({ request }) => {
  const response = await request.post("/api/exams/start", {
    headers: {
      Origin: appOrigin,
      "Content-Type": "application/json",
    },
    data: { quizId: "30000000-0000-4000-8000-000000000051" },
  });

  const body = await response.json();
  expect(response.status(), body.message).toBe(401);
  expect(body.message).toContain("Log in");
});

test("examination answer and submission endpoints reject unauthenticated requests", async ({ request }) => {
  const attemptId = "40000000-0000-4000-8000-000000000051";
  const headers = {
    Origin: appOrigin,
    "Content-Type": "application/json",
  };
  const [answersResponse, submitResponse] = await Promise.all([
    request.post(`/api/exams/${attemptId}/answers`, {
      headers,
      data: { answers: ["A", null] },
    }),
    request.post(`/api/exams/${attemptId}/submit`, {
      headers,
      data: {},
    }),
  ]);
  const [answersBody, submitBody] = await Promise.all([
    answersResponse.json(),
    submitResponse.json(),
  ]);

  expect(answersResponse.status(), answersBody.message).toBe(401);
  expect(submitResponse.status(), submitBody.message).toBe(401);
});
