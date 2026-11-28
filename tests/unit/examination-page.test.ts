import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireGuestWorkspace: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
  createAdminSupabaseClient: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/guest-workspace", () => ({
  requireGuestWorkspace: mocks.requireGuestWorkspace,
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: mocks.createAdminSupabaseClient,
}));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.loggerError } }));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/examination", () => ({ Examination: () => null }));

import ExaminationPage from "@/app/dashboard/exams/[attemptId]/page";

const attemptId = "30000000-0000-4000-8000-000000000051";
const quizId = "30000000-0000-4000-8000-000000000052";
const workspaceId = "30000000-0000-4000-8000-000000000050";
const attempt = {
  attempt_id: attemptId,
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
const quiz = {
  id: quizId,
  title: "Guest workspace quiz",
  source_document_id: "30000000-0000-4000-8000-000000000054",
  question_count: 1,
  duration_minutes: 5,
  generation_status: "ready",
};
const savedQuestions = [{
  question: "Which choice is supported by the study source?",
  options: [
    { label: "A", text: "Supported answer" },
    { label: "B", text: "First distractor" },
    { label: "C", text: "Second distractor" },
    { label: "D", text: "Third distractor" },
  ],
  correctAnswer: "A",
  explanation: "The source explicitly supports this answer.",
  difficulty: "easy",
  topic: "Science",
  sourceRefs: ["S001"],
}];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function makeQuery(
  table: string,
  result: Promise<unknown>,
  queryFilters: Array<[string, string, string]>,
) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: string) => {
      queryFilters.push([table, column, value]);
      return query;
    }),
    maybeSingle: vi.fn(() => result),
  };
  return query;
}

describe("examination attempt page", () => {
  let rpc: ReturnType<typeof vi.fn>;
  let workspaceFrom: ReturnType<typeof vi.fn>;
  let adminFrom: ReturnType<typeof vi.fn>;
  let documentLookup: ReturnType<typeof deferred<unknown>>;
  let questionLookup: ReturnType<typeof deferred<unknown>>;
  let queryFilters: Array<[string, string, string]>;

  beforeEach(() => {
    rpc = vi.fn().mockResolvedValue({ data: [attempt], error: null });
    queryFilters = [];
    documentLookup = deferred();
    questionLookup = deferred();

    workspaceFrom = vi.fn((table: string) =>
      makeQuery(
        table,
        Promise.resolve(
          table === "learning_quizzes"
            ? { data: quiz, error: null }
            : { data: null, error: null },
        ),
        queryFilters,
      ),
    );
    adminFrom = vi.fn((table: string) =>
      makeQuery(
        table,
        table === "learning_quizzes" ? questionLookup.promise : Promise.resolve({ data: null, error: null }),
        queryFilters,
      ),
    );

    mocks.requireGuestWorkspace.mockReset().mockResolvedValue({
      supabase: { rpc, from: workspaceFrom },
      user: { id: workspaceId, guestTokenHash: "g".repeat(64) },
    });
    mocks.notFound.mockReset().mockImplementation(() => {
      throw new Error("not-found");
    });
    mocks.redirect.mockReset().mockImplementation(() => {
      throw new Error("redirect");
    });
    mocks.createAdminSupabaseClient.mockReset().mockReturnValue({ from: adminFrom });
    mocks.loggerError.mockReset();
  });

  it("loads safe question views while the independent document and question reads run concurrently", async () => {
    workspaceFrom.mockImplementation((table: string) =>
      makeQuery(
        table,
        table === "learning_quizzes"
          ? Promise.resolve({ data: quiz, error: null })
          : documentLookup.promise,
        queryFilters,
      ),
    );
    adminFrom.mockImplementation((table: string) =>
      makeQuery(table, questionLookup.promise, queryFilters),
    );

    const pagePromise = ExaminationPage({
      params: Promise.resolve({ attemptId }),
    });
    for (let tick = 0; tick < 12; tick += 1) await Promise.resolve();

    expect(workspaceFrom).toHaveBeenCalledWith("learning_documents");
    expect(adminFrom).toHaveBeenCalledWith("learning_quizzes");
    expect(rpc).toHaveBeenCalledWith("guest_get_quiz_attempt_state", {
      p_token_hash: "g".repeat(64),
      p_attempt_id: attemptId,
    });
    expect(queryFilters).toContainEqual(["learning_quizzes", "user_id", workspaceId]);
    expect(queryFilters).toContainEqual(["learning_documents", "user_id", workspaceId]);
    expect(queryFilters.filter(([table, column]) =>
      table === "learning_quizzes" && column === "user_id",
    )).toHaveLength(2);

    documentLookup.resolve({ data: { original_filename: "notes.pdf" }, error: null });
    questionLookup.resolve({ data: { questions: savedQuestions }, error: null });
    const page = await pagePromise;

    expect(isValidElement(page)).toBe(true);
    const examinationElement = (page as ReactElement<{ children: ReactNode }>).props.children;
    expect(isValidElement(examinationElement)).toBe(true);
    const props = (examinationElement as ReactElement<{
      questions: Array<Record<string, unknown>>;
      sourceFilename: string;
    }>).props;
    expect(props.sourceFilename).toBe("notes.pdf");
    expect(props.questions).toHaveLength(1);
    expect(props.questions[0]).not.toHaveProperty("correctAnswer");
    expect(props.questions[0]).not.toHaveProperty("explanation");
  });

  it("continues to reject saved questions that fail validation", async () => {
    workspaceFrom.mockImplementation((table: string) =>
      makeQuery(
        table,
        table === "learning_quizzes"
          ? Promise.resolve({ data: quiz, error: null })
          : Promise.resolve({ data: { original_filename: "notes.pdf" }, error: null }),
        queryFilters,
      ),
    );
    adminFrom.mockImplementation((table: string) =>
      makeQuery(
        table,
        Promise.resolve({ data: { questions: [{ question: "incomplete" }] }, error: null }),
        queryFilters,
      ),
    );

    await expect(ExaminationPage({
      params: Promise.resolve({ attemptId }),
    })).rejects.toThrow("not-found");
  });

  it("does not continue to quiz data when the guest attempt RPC denies access", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });

    await expect(ExaminationPage({
      params: Promise.resolve({ attemptId }),
    })).rejects.toThrow("not-found");

    expect(workspaceFrom).not.toHaveBeenCalled();
    expect(mocks.createAdminSupabaseClient).not.toHaveBeenCalled();
  });
});
