import { describe, expect, it } from "vitest";
import {
  buildQuestionReviews,
  buildSubjectPerformance,
  buildTopicPerformance,
  formatTimeTaken,
  getPerformanceClassification,
  getTimeTakenMilliseconds,
  summarizeCompletedAttempts,
  type AttemptQuestionSet,
  type CompletedAttemptMetric,
  type PerformanceQuestion,
} from "@/lib/performance/analytics";
import {
  filterPerformanceAttempts,
  parsePerformanceFilters,
} from "@/lib/performance/filters";
import type { PerformanceAttemptRecord } from "@/lib/performance/data";
import {
  generatePerformanceRecommendations,
  PerformanceRecommendationError,
  validatePerformanceRecommendations,
  type PerformanceRecommendationInput,
} from "@/lib/performance/recommendations";

const question = (
  topic: string,
  correctAnswer: "A" | "B" = "A",
): PerformanceQuestion => ({
  question: `Which statement describes ${topic}?`,
  options: [
    { label: "A", text: "Supported" },
    { label: "B", text: "Incorrect" },
    { label: "C", text: "Unrelated" },
    { label: "D", text: "Not stated" },
  ],
  correctAnswer,
  explanation: `The source explains the supported ${topic} statement.`,
  difficulty: "easy",
  topic,
  sourceRefs: ["S001"],
});

const attemptSet = (
  attemptId: string,
  questions: PerformanceQuestion[],
  answers: ("A" | "B" | "C" | "D" | null)[],
  subject = "Biology",
): AttemptQuestionSet => ({ attemptId, subject, questions, answers });

function recommendationInput(
  sourceRefs: string[] = ["S001"],
): PerformanceRecommendationInput {
  const performanceQuestion = {
    ...question("Mitosis"),
    sourceRefs,
  };
  const questions = [performanceQuestion];
  const answers: ("A" | "B" | "C" | "D" | null)[] = ["B"];
  const questionReviews = buildQuestionReviews(questions, answers);
  return {
    documentTitle: "Cell biology",
    subject: "Biology",
    overallPercentage: 0,
    correctCount: 0,
    incorrectCount: 1,
    unansweredCount: 0,
    topics: buildTopicPerformance([
      attemptSet("recommendation-attempt", questions, answers),
    ]),
    questionReviews,
    analysis: {
      title: "Cell biology",
      subject: "Biology",
      summary: "A brief study summary.",
      topics: [{ name: "Mitosis", subtopics: [], sourceRefs: ["S001"] }],
      keyConcepts: [],
      definitions: [],
      importantFacts: [],
    },
    sources: sourceRefs.map((sourceId) => ({
      sourceId,
      title: "Cell division",
      pageOrLocation: "Page 1",
    })),
  };
}

describe("performance analytics", () => {
  it("classifies answer outcomes without counting unanswered questions as responses", () => {
    const reviews = buildQuestionReviews(
      [question("Mitosis"), question("Anaphase"), question("DNA", "B")],
      ["A", "B", null],
    );

    expect(reviews.map((review) => review.outcome)).toEqual([
      "correct",
      "incorrect",
      "unanswered",
    ]);
  });

  it("requires five answered questions before classifying a topic", () => {
    const few = buildTopicPerformance([
      attemptSet("a", [question("Mitosis"), question("Mitosis")], ["A", "A"]),
    ]);
    expect(few[0]).toMatchObject({
      answeredCount: 2,
      accuracy: 100,
      classification: "insufficient_data",
    });

    const enough = buildTopicPerformance([
      attemptSet(
        "b",
        Array.from({ length: 5 }, () => question("Mitosis")),
        ["A", "A", "A", "A", "B"],
      ),
    ]);
    expect(enough[0]).toMatchObject({
      answeredCount: 5,
      correctCount: 4,
      accuracy: 80,
      classification: "strong",
    });
  });

  it("identifies topics needing review and gives unanswered topics insufficient-data status", () => {
    const topics = buildTopicPerformance([
      attemptSet(
        "c",
        [
          ...Array.from({ length: 5 }, () => question("Cell cycle")),
          question("DNA"),
        ],
        ["B", "B", "A", "B", "B", null],
      ),
    ]);

    expect(topics).toEqual([
      expect.objectContaining({
        name: "Cell cycle",
        incorrectCount: 4,
        accuracy: 20,
        classification: "needs_review",
      }),
      expect.objectContaining({
        name: "DNA",
        unansweredCount: 1,
        answeredCount: 0,
        classification: "insufficient_data",
      }),
    ]);
  });

  it("groups subject performance and ignores duplicate copies of an attempt", () => {
    const sample = attemptSet(
      "same-attempt",
      Array.from({ length: 5 }, () => question("Mitosis")),
      ["A", "A", "A", "A", "A"],
      "Biology",
    );
    const subjects = buildSubjectPerformance([sample, sample]);
    expect(subjects).toHaveLength(1);
    expect(subjects[0]).toMatchObject({
      name: "Biology",
      questionCount: 5,
      answeredCount: 5,
      classification: "strong",
    });
  });

  it("summarizes only unique completed attempts and reports no trend for one result", () => {
    const attempt = {
      attemptId: "attempt-1",
      submittedAt: "2026-11-25T10:00:00Z",
      percentage: 80,
      questionCount: 5,
      correctCount: 4,
      incorrectCount: 1,
      unansweredCount: 0,
    } satisfies CompletedAttemptMetric;
    expect(summarizeCompletedAttempts([attempt, attempt])).toMatchObject({
      completedCount: 1,
      averageScore: 80,
      totalAnsweredQuestions: 5,
      correctAnswerPercentage: 80,
      trendChange: null,
      trendDirection: "insufficient_data",
    });
  });

  it("calculates score trends from chronological results", () => {
    const attempts: CompletedAttemptMetric[] = [
      {
        attemptId: "second",
        submittedAt: "2026-11-25T11:00:00Z",
        percentage: 75,
        questionCount: 4,
        correctCount: 3,
        incorrectCount: 1,
        unansweredCount: 0,
      },
      {
        attemptId: "first",
        submittedAt: "2026-11-25T10:00:00Z",
        percentage: 50,
        questionCount: 4,
        correctCount: 2,
        incorrectCount: 2,
        unansweredCount: 0,
      },
    ];
    expect(summarizeCompletedAttempts(attempts)).toMatchObject({
      trendChange: 25,
      trendDirection: "improving",
    });
  });

  it("bounds displayed time taken by the server-set deadline", () => {
    const milliseconds = getTimeTakenMilliseconds(
      "2026-11-25T10:00:00Z",
      "2026-11-25T10:12:00Z",
      "2026-11-25T10:10:00Z",
    );
    expect(milliseconds).toBe(10 * 60 * 1000);
    expect(formatTimeTaken(milliseconds)).toBe("10m 0s");
  });

  it("classifies result percentages with readable labels", () => {
    expect(getPerformanceClassification(95)).toBe("Excellent");
    expect(getPerformanceClassification(80)).toBe("Strong");
    expect(getPerformanceClassification(65)).toBe("Developing");
    expect(getPerformanceClassification(40)).toBe("Needs practice");
  });

  it("filters finalized history by subject, source document and date", () => {
    const rows: PerformanceAttemptRecord[] = [
      {
        attemptId: "a",
        quizId: "10000000-0000-4000-8000-000000000001",
        quizTitle: "Cell cycle",
        sourceDocumentId: "20000000-0000-4000-8000-000000000001",
        sourceFilename: "biology.txt",
        subject: "Biology",
        questionCount: 5,
        startedAt: "2026-11-24T10:00:00Z",
        deadlineAt: "2026-11-24T10:10:00Z",
        submittedAt: "2026-11-24T10:05:00Z",
        correctCount: 4,
        incorrectCount: 1,
        unansweredCount: 0,
        percentage: 80,
        answers: ["A", "B", "A", "A", "A"],
        questions: null,
      },
      {
        attemptId: "b",
        quizId: "10000000-0000-4000-8000-000000000002",
        quizTitle: "Energy",
        sourceDocumentId: "20000000-0000-4000-8000-000000000002",
        sourceFilename: "physics.txt",
        subject: "Physics",
        questionCount: 5,
        startedAt: "2026-11-25T10:00:00Z",
        deadlineAt: "2026-11-25T10:10:00Z",
        submittedAt: "2026-11-25T10:05:00Z",
        correctCount: 3,
        incorrectCount: 2,
        unansweredCount: 0,
        percentage: 60,
        answers: ["A", "B", "A", "B", "A"],
        questions: null,
      },
    ];
    const parsed = parsePerformanceFilters({
      subject: "Biology",
      source: "20000000-0000-4000-8000-000000000001",
      from: "2026-11-24",
      to: "2026-11-24",
    });
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(filterPerformanceAttempts(rows, parsed.filters).map((row) => row.attemptId))
      .toEqual(["a"]);
  });

  it("rejects invalid date ranges and malformed source filters", () => {
    expect(parsePerformanceFilters({
      from: "2026-11-25",
      to: "2026-11-24",
    }).valid).toBe(false);
    expect(parsePerformanceFilters({
      source: "not-a-uuid",
    }).valid).toBe(false);
  });

  it("rejects AI recommendations with unsupported topics or source references", () => {
    const input = recommendationInput();
    expect(() => validatePerformanceRecommendations({
      recommendations: [{
        title: "Review another subject",
        action: "Study an unrelated topic from another resource.",
        topic: "Physics",
        sourceRefs: ["S001"],
      }],
    }, input)).toThrow(PerformanceRecommendationError);
    expect(() => validatePerformanceRecommendations({
      recommendations: [{
        title: "Review Mitosis",
        action: "Revisit the relevant section and retry the missed question.",
        topic: "Mitosis",
        sourceRefs: ["S999"],
      }],
    }, input)).toThrow(PerformanceRecommendationError);
  });

  it("uses grounded deterministic recommendations when Gemini fails", async () => {
    const input = recommendationInput();
    const result = await generatePerformanceRecommendations({
      generate: async () => {
        throw new PerformanceRecommendationError(
          "recommendations_unavailable",
          "Gemini unavailable",
        );
      },
    }, input);

    expect(result.generationStatus).toBe("fallback");
    expect(result.recommendations[0]).toMatchObject({
      topic: "Mitosis",
      sourceRefs: ["S001"],
    });
  });

  it("allows grounded fallback recommendations when a quiz has no source references", async () => {
    const input = recommendationInput([]);
    const result = await generatePerformanceRecommendations({
      generate: async () => {
        throw new PerformanceRecommendationError(
          "recommendations_not_configured",
          "Gemini unavailable",
        );
      },
    }, input);

    expect(result.generationStatus).toBe("fallback");
    expect(result.recommendations[0].sourceRefs).toEqual([]);
  });
});
