import "server-only";
import { z } from "zod";
import type { DatabaseClient } from "@/lib/supabase/types";
import { logger } from "@/lib/logger";
import { documentAnalysisSchema } from "@/lib/materials/types";
import {
  attemptAnswersSchema,
  answerChoiceSchema,
} from "@/lib/exams/types";
import {
  quizDifficultySchema,
  quizQuestionsSchema,
} from "@/lib/quizzes/types";
import type { PerformanceQuestion } from "@/lib/performance/analytics";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const finalizedAttemptRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  quiz_id: z.uuid(),
  question_count: z.number().int().min(1).max(30),
  started_at: z.iso.datetime({ offset: true }),
  deadline_at: z.iso.datetime({ offset: true }),
  answers: attemptAnswersSchema,
  status: z.literal("submitted"),
  submitted_at: z.iso.datetime({ offset: true }),
  total_score: z.number().int().min(0),
  correct_count: z.number().int().min(0),
  incorrect_count: z.number().int().min(0),
  unanswered_count: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
}).superRefine((attempt, context) => {
  if (
    attempt.answers.length !== attempt.question_count ||
    attempt.correct_count + attempt.incorrect_count + attempt.unanswered_count !==
      attempt.question_count ||
    attempt.total_score !== attempt.correct_count
  ) {
    context.addIssue({
      code: "custom",
      message: "The finalized attempt data is internally inconsistent.",
    });
  }
});

const quizRowSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  source_document_id: z.uuid(),
  question_count: z.number().int().min(1).max(30),
  difficulty: quizDifficultySchema,
});

const documentRowSchema = z.object({
  id: z.uuid(),
  original_filename: z.string().min(1),
  analysis: z.unknown(),
});

export type FinalizedAttemptRow = z.infer<typeof finalizedAttemptRowSchema>;

export type PerformanceAttemptRecord = {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  sourceDocumentId: string;
  sourceFilename: string;
  subject: string;
  questionCount: number;
  startedAt: string;
  deadlineAt: string;
  submittedAt: string;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  percentage: number;
  answers: (z.infer<typeof answerChoiceSchema> | null)[];
  questions: PerformanceQuestion[] | null;
};

export class PerformanceDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PerformanceDataError";
  }
}

function chunk<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function loadFinalizedAttempts(
  supabase: DatabaseClient,
  userId: string,
) {
  const attempts: FinalizedAttemptRow[] = [];
  const pageSize = 500;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select(
        "id,user_id,quiz_id,question_count,started_at,deadline_at,answers,status,submitted_at,total_score,correct_count,incorrect_count,unanswered_count,percentage",
      )
      .eq("user_id", userId)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) {
      logger.error("Finalized performance attempts could not be loaded", {
        code: error.code ?? null,
      });
      throw new PerformanceDataError("Your examination history could not be loaded.");
    }

    const parsedRows = z.array(finalizedAttemptRowSchema).safeParse(data);
    if (!parsedRows.success) {
      logger.error("Finalized performance attempts failed validation");
      throw new PerformanceDataError("Your examination history could not be validated.");
    }
    attempts.push(...parsedRows.data);
    if (parsedRows.data.length < pageSize) break;
    offset += pageSize;
  }

  return attempts;
}

export async function getOwnedQuizQuestions(
  userId: string,
  quizId: string,
  expectedQuestionCount: number,
) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("learning_quizzes")
    .select("questions")
    .eq("id", quizId)
    .eq("user_id", userId)
    .eq("generation_status", "ready")
    .maybeSingle();
  const questions = quizQuestionsSchema.safeParse(data?.questions);
  if (error || !questions.success || questions.data.length !== expectedQuestionCount) {
    logger.error("Owned quiz questions could not be validated", {
      quizId,
      code: error?.code ?? null,
    });
    throw new PerformanceDataError("The question review is temporarily unavailable.");
  }
  return questions.data;
}

export async function loadLearnerPerformance(
  supabase: DatabaseClient,
  userId: string,
): Promise<PerformanceAttemptRecord[]> {
  const attempts = await loadFinalizedAttempts(supabase, userId);
  const quizIds = [...new Set(attempts.map((attempt) => attempt.quiz_id))];
  if (!quizIds.length) return [];

  const quizRows: z.infer<typeof quizRowSchema>[] = [];
  for (const ids of chunk(quizIds, 200)) {
    const { data, error } = await supabase
      .from("learning_quizzes")
      .select("id,title,source_document_id,question_count,difficulty")
      .eq("user_id", userId)
      .in("id", ids);
    if (error) {
      logger.error("Owned performance quizzes could not be loaded", {
        code: error.code ?? null,
      });
      throw new PerformanceDataError("Your examination history could not be loaded.");
    }
    const parsedRows = z.array(quizRowSchema).safeParse(data);
    if (!parsedRows.success) {
      logger.error("Owned performance quizzes failed validation");
      throw new PerformanceDataError("Your examination history could not be validated.");
    }
    quizRows.push(...parsedRows.data);
  }

  const quizById = new Map(quizRows.map((quiz) => [quiz.id, quiz]));
  const documentIds = [...new Set(quizRows.map((quiz) => quiz.source_document_id))];
  const documentRows: z.infer<typeof documentRowSchema>[] = [];
  for (const ids of chunk(documentIds, 200)) {
    const { data, error } = await supabase
      .from("learning_documents")
      .select("id,original_filename,analysis")
      .eq("user_id", userId)
      .in("id", ids);
    if (error) {
      logger.error("Owned performance source documents could not be loaded", {
        code: error.code ?? null,
      });
      throw new PerformanceDataError("Your source material could not be loaded.");
    }
    const parsedRows = z.array(documentRowSchema).safeParse(data);
    if (!parsedRows.success) {
      logger.error("Owned performance source documents failed validation");
      throw new PerformanceDataError("Your source material could not be validated.");
    }
    documentRows.push(...parsedRows.data);
  }
  const documentById = new Map(documentRows.map((document) => [document.id, document]));

  const admin = createAdminSupabaseClient();
  const questionRows: { id: string; questions: unknown }[] = [];
  for (const ids of chunk(quizIds, 100)) {
    const { data, error } = await admin
      .from("learning_quizzes")
      .select("id,questions")
      .eq("user_id", userId)
      .eq("generation_status", "ready")
      .in("id", ids);
    if (error) {
      logger.error("Owned quiz questions for performance could not be loaded", {
        code: error.code ?? null,
      });
      throw new PerformanceDataError("Topic analysis is temporarily unavailable.");
    }
    questionRows.push(...(data ?? []));
  }
  const questionsByQuizId = new Map(
    questionRows.map((row) => [row.id, quizQuestionsSchema.safeParse(row.questions)]),
  );

  return attempts.map((attempt) => {
    const quiz = quizById.get(attempt.quiz_id);
    const document = quiz ? documentById.get(quiz.source_document_id) : undefined;
    if (!quiz || !document) {
      logger.error("A finalized attempt is missing its owned quiz or source document", {
        attemptId: attempt.id,
      });
      throw new PerformanceDataError("Some examination history is unavailable.");
    }

    const questionsResult = questionsByQuizId.get(quiz.id);
    const questions =
      questionsResult?.success &&
      questionsResult.data.length === attempt.question_count &&
      attempt.question_count === quiz.question_count
        ? questionsResult.data
        : null;
    if (!questions) {
      logger.error("Saved questions for a finalized attempt are incomplete", {
        attemptId: attempt.id,
        quizId: quiz.id,
      });
    }
    const analysis = documentAnalysisSchema.safeParse(document.analysis);

    return {
      attemptId: attempt.id,
      quizId: quiz.id,
      quizTitle: quiz.title,
      sourceDocumentId: quiz.source_document_id,
      sourceFilename: document.original_filename,
      subject: analysis.success ? analysis.data.subject : "Uncategorised",
      questionCount: attempt.question_count,
      startedAt: attempt.started_at,
      deadlineAt: attempt.deadline_at,
      submittedAt: attempt.submitted_at,
      correctCount: attempt.correct_count,
      incorrectCount: attempt.incorrect_count,
      unansweredCount: attempt.unanswered_count,
      percentage: attempt.percentage,
      answers: attempt.answers,
      questions,
    };
  });
}
