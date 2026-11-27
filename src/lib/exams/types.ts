import { z } from "zod";
import {
  quizQuestionFieldsSchema,
  quizQuestionsSchema,
} from "@/lib/quizzes/types";

export const answerChoiceSchema = z.enum(["A", "B", "C", "D"]);
export const attemptAnswersSchema = z.array(
  z.union([answerChoiceSchema, z.null()]),
).min(1).max(30);

export const attemptStatusSchema = z.enum(["in_progress", "submitted"]);
export const submissionReasonSchema = z.enum(["manual", "timeout"]);

export const quizAttemptStateSchema = z.object({
  attempt_id: z.uuid(),
  quiz_id: z.uuid(),
  question_count: z.number().int().min(1).max(30),
  started_at: z.iso.datetime({ offset: true }),
  deadline_at: z.iso.datetime({ offset: true }),
  answers: attemptAnswersSchema,
  status: attemptStatusSchema,
  submitted_at: z.iso.datetime({ offset: true }).nullable(),
  submission_reason: submissionReasonSchema.nullable(),
  total_score: z.number().int().nullable(),
  correct_count: z.number().int().nullable(),
  incorrect_count: z.number().int().nullable(),
  unanswered_count: z.number().int().nullable(),
  percentage: z.number().min(0).max(100).nullable(),
  server_now: z.iso.datetime({ offset: true }),
}).superRefine((attempt, context) => {
  if (attempt.answers.length !== attempt.question_count) {
    context.addIssue({
      code: "custom",
      path: ["answers"],
      message: "The saved answer count must match the examination question count.",
    });
  }

  if (attempt.status === "in_progress") {
    if (
      attempt.submitted_at !== null ||
      attempt.submission_reason !== null ||
      attempt.total_score !== null ||
      attempt.correct_count !== null ||
      attempt.incorrect_count !== null ||
      attempt.unanswered_count !== null ||
      attempt.percentage !== null
    ) {
      context.addIssue({
        code: "custom",
        message: "An active examination cannot include final results.",
      });
    }
    return;
  }

  if (
    attempt.submitted_at === null ||
    attempt.submission_reason === null ||
    attempt.correct_count === null ||
    attempt.incorrect_count === null ||
    attempt.unanswered_count === null ||
    attempt.total_score === null ||
    attempt.percentage === null ||
    attempt.total_score !== attempt.correct_count ||
    attempt.correct_count + attempt.incorrect_count + attempt.unanswered_count !==
      attempt.question_count ||
    attempt.percentage !==
      Math.round((attempt.correct_count * 10000) / attempt.question_count) / 100
  ) {
    context.addIssue({
      code: "custom",
      message: "Submitted examination results are incomplete.",
    });
  }
});

export const examQuestionViewsSchema = quizQuestionsSchema.transform(
  (questions) => questions.map((question) => ({
    question: question.question,
    options: question.options,
    difficulty: question.difficulty,
    topic: question.topic,
    sourceRefs: question.sourceRefs,
  })),
);

export type QuizAttemptState = z.infer<typeof quizAttemptStateSchema>;
export const examQuestionViewListSchema = z.array(
  quizQuestionFieldsSchema.omit({
    correctAnswer: true,
    explanation: true,
  }),
).min(1).max(30);
export type ExamQuestionView = z.infer<typeof examQuestionViewListSchema>[number];

export function parseAttemptRpcResult(value: unknown): QuizAttemptState | null {
  const rows = Array.isArray(value) ? value : [value];
  if (rows.length !== 1) return null;
  const parsed = quizAttemptStateSchema.safeParse(rows[0]);
  return parsed.success ? parsed.data : null;
}
