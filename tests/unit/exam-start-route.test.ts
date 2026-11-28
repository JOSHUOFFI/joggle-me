import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getExamLearnerContext: vi.fn(),
  isSameOriginExamRequest: vi.fn(),
}));

vi.mock("@/lib/exams/request", () => ({
  examJson: (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    }),
  getExamLearnerContext: mocks.getExamLearnerContext,
  isSameOriginExamRequest: mocks.isSameOriginExamRequest,
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { POST } from "@/app/api/exams/start/route";

const quizId = "30000000-0000-4000-8000-000000000052";
const activeAttempt = {
  attempt_id: "30000000-0000-4000-8000-000000000051",
  quiz_id: quizId,
  question_count: 1,
  started_at: "2026-11-25T10:00:00Z",
  deadline_at: "2026-11-25T10:05:00Z",
  answers: [null],
  status: "in_progress",
  submitted_at: null,
  submission_reason: null,
  total_score: null,
  correct_count: null,
  incorrect_count: null,
  unanswered_count: null,
  percentage: null,
  server_now: "2026-11-25T10:00:01Z",
};

function makeRequest(body: unknown) {
  return { json: async () => body } as never;
}

describe("POST /api/exams/start", () => {
  const rpc = vi.fn();
  const from = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    mocks.isSameOriginExamRequest.mockReset().mockReturnValue(true);
    mocks.getExamLearnerContext.mockReset().mockResolvedValue({
      ok: true,
      supabase: { rpc, from },
      user: { id: "workspace-a", guestTokenHash: "a".repeat(64) },
    });
  });

  it.each([
    ["a newly created attempt", activeAttempt],
    ["an existing attempt resumed by the RPC", {
      ...activeAttempt,
      attempt_id: "30000000-0000-4000-8000-000000000053",
    }],
  ])("returns %s without loading quiz questions", async (_label, attempt) => {
    rpc.mockResolvedValue({ data: [attempt], error: null });

    const response = await POST(makeRequest({ quizId }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ state: attempt });
    expect(rpc).toHaveBeenCalledWith("guest_start_quiz_attempt", {
      p_token_hash: "a".repeat(64),
      p_quiz_id: quizId,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("retains the guest RPC ownership failure response", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });

    const response = await POST(makeRequest({ quizId }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      message: "That ready quiz could not be found.",
    });
    expect(from).not.toHaveBeenCalled();
  });
});
