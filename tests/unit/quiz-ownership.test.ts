import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireGuestWorkspace: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/lib/guest-workspace", () => ({ requireGuestWorkspace: mocks.requireGuestWorkspace }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/actions/quizzes", () => ({ deleteQuizAction: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(),
}));
vi.mock("@/components/app-shell", () => ({ AppShell: () => null }));
vi.mock("@/components/learning-materials", () => ({
  ProcessingRefresh: () => null,
}));
vi.mock("@/components/ui/button", () => ({ Button: () => null }));
vi.mock("@/components/ui/card", () => ({ Card: () => null }));

import QuizPreviewPage from "@/app/dashboard/quizzes/[id]/page";

const quizId = "11111111-1111-4111-8111-111111111111";

describe("quiz ownership checks", () => {
  beforeEach(() => {
    mocks.requireGuestWorkspace.mockReset();
    mocks.notFound.mockReset().mockImplementation(() => {
      throw new Error("not-found");
    });

    mocks.requireGuestWorkspace.mockResolvedValue({
      user: { id: "current-workspace", guestTokenHash: "a".repeat(64) },
      supabase: {
        from: vi.fn((table: string) => {
          const filters = new Map<string, string>();
          const query = {
            select: vi.fn(() => query),
            eq: vi.fn((column: string, value: string) => {
              filters.set(column, value);
              return query;
            }),
            maybeSingle: vi.fn(async () => {
              if (table === "learning_quizzes") {
                if (
                  filters.get("id") === quizId &&
                  filters.get("user_id") === "current-workspace"
                ) {
                  return { data: null, error: null };
                }
                return {
                  data: {
                    id: quizId,
                    title: "Another learner's quiz",
                    source_document_id: "22222222-2222-4222-8222-222222222222",
                    question_count: 1,
                    difficulty: "easy",
                    duration_minutes: 5,
                    selected_topics: [],
                    generation_status: "generating",
                    created_at: "2026-01-01T00:00:00Z",
                  },
                  error: null,
                };
              }
              return { data: null, error: null };
            }),
          };
          return query;
        }),
      },
    });
  });

  it("does not load another learner's quiz through the service-role client", async () => {
    await expect(
      QuizPreviewPage({ params: Promise.resolve({ id: quizId }) }),
    ).rejects.toThrow("not-found");
  });
});
