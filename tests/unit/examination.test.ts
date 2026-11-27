import { describe, expect, it } from "vitest";
import {
  attemptAnswersSchema,
  examQuestionViewsSchema,
  quizAttemptStateSchema,
} from "@/lib/exams/types";
import { getPerformanceRemark } from "@/lib/exams/results";

const questionSet = [{
  question: "Which choice is supported by the study source?",
  options: [
    { label: "A", text: "Supported answer" },
    { label: "B", text: "First distractor" },
    { label: "C", text: "Second distractor" },
    { label: "D", text: "Third distractor" },
  ],
  correctAnswer: "A",
  explanation: "The study source explicitly supports this answer.",
  difficulty: "easy",
  topic: "Science",
  sourceRefs: ["S001"],
}];

const activeAttempt = {
  attempt_id: "30000000-0000-4000-8000-000000000051",
  quiz_id: "30000000-0000-4000-8000-000000000052",
  question_count: 2,
  started_at: "2026-11-25T10:00:00Z",
  deadline_at: "2026-11-25T10:01:00Z",
  answers: [null, "B"],
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

describe("examination contracts", () => {
  it("strips answer keys and explanations from examination question views", () => {
    const [question] = examQuestionViewsSchema.parse(questionSet);
    expect(question.question).toBe(questionSet[0].question);
    expect(question.options).toHaveLength(4);
    expect(question).not.toHaveProperty("correctAnswer");
    expect(question).not.toHaveProperty("explanation");
  });

  it("accepts only answer labels or unanswered slots", () => {
    expect(attemptAnswersSchema.safeParse(["A", null, "D"]).success).toBe(true);
    expect(attemptAnswersSchema.safeParse(["E"]).success).toBe(false);
    expect(attemptAnswersSchema.safeParse(Array.from({ length: 31 }, () => null)).success).toBe(false);
  });

  it("keeps final scores out of active attempt state", () => {
    expect(quizAttemptStateSchema.safeParse(activeAttempt).success).toBe(true);
    expect(quizAttemptStateSchema.safeParse({
      ...activeAttempt,
      correct_count: 1,
      incorrect_count: 0,
      unanswered_count: 1,
      percentage: 50,
    }).success).toBe(false);
  });

  it("requires complete, internally consistent submitted results", () => {
    const submitted = {
      ...activeAttempt,
      status: "submitted",
      submitted_at: "2026-11-25T10:00:30Z",
      submission_reason: "manual",
      total_score: 1,
      correct_count: 1,
      incorrect_count: 0,
      unanswered_count: 1,
      percentage: 50,
    };
    expect(quizAttemptStateSchema.safeParse(submitted).success).toBe(true);
    expect(quizAttemptStateSchema.safeParse({
      ...submitted,
      incorrect_count: 1,
    }).success).toBe(false);
  });

  it("returns clear performance remarks at score thresholds", () => {
    expect(getPerformanceRemark(90)).toContain("Excellent");
    expect(getPerformanceRemark(75)).toContain("Great");
    expect(getPerformanceRemark(50)).toContain("Good effort");
    expect(getPerformanceRemark(49)).toContain("Keep practising");
  });
});
