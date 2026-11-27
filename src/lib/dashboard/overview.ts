import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const documentSchema = z.object({
  id: z.uuid(),
  original_filename: z.string(),
  file_type: z.enum(["pdf", "docx", "txt"]),
  status: z.enum(["queued", "processing", "ready", "failed", "deleting"]),
  analysis_status: z.enum(["queued", "processing", "ready", "failed"]),
  created_at: z.iso.datetime({ offset: true }),
});

const quizSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  question_count: z.number().int(),
  generation_status: z.enum(["generating", "ready", "failed"]),
  created_at: z.iso.datetime({ offset: true }),
});

const attemptSchema = z.object({
  id: z.uuid(),
  quiz_id: z.uuid(),
  percentage: z.coerce.number().min(0).max(100),
  submitted_at: z.iso.datetime({ offset: true }),
});

const activeAttemptSchema = z.object({
  id: z.uuid(),
  quiz_id: z.uuid(),
  started_at: z.iso.datetime({ offset: true }),
  deadline_at: z.iso.datetime({ offset: true }),
});

export type DashboardOverview = {
  materialCount: number | null;
  analyzedMaterialCount: number | null;
  quizCount: number | null;
  readyQuizCount: number | null;
  completedExamCount: number | null;
  recentAverage: number | null;
  attemptsAvailable: boolean;
  activeAttemptAvailable: boolean;
  documentsAvailable: boolean;
  quizzesAvailable: boolean;
  recentAttempts: z.infer<typeof attemptSchema>[];
  recentDocuments: z.infer<typeof documentSchema>[];
  recentQuizzes: z.infer<typeof quizSchema>[];
  activeAttempt: (z.infer<typeof activeAttemptSchema> & { quizTitle: string }) | null;
};

function checkedRows<T>(
  table: string,
  data: unknown,
  schema: z.ZodType<T>,
): T[] | null {
  const parsed = z.array(schema).safeParse(data);
  if (parsed.success) return parsed.data;
  logger.warn("Learner dashboard data failed validation", { table });
  return null;
}

export async function loadDashboardOverview(
  supabase: SupabaseClient,
  userId: string,
): Promise<DashboardOverview> {
  const [materialCountResult, analyzedCountResult, quizCountResult, readyQuizCountResult, examCountResult, attemptsResult, activeResult, documentsResult, quizzesResult] = await Promise.all([
    supabase.from("learning_documents").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("learning_documents").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("analysis_status", "ready"),
    supabase.from("learning_quizzes").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("learning_quizzes").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("generation_status", "ready"),
    supabase.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "submitted"),
    supabase.from("quiz_attempts").select("id,quiz_id,percentage,submitted_at").eq("user_id", userId).eq("status", "submitted").order("submitted_at", { ascending: false }).limit(6),
    supabase.from("quiz_attempts").select("id,quiz_id,started_at,deadline_at").eq("user_id", userId).eq("status", "in_progress").order("started_at", { ascending: false }).limit(1),
    supabase.from("learning_documents").select("id,original_filename,file_type,status,analysis_status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(3),
    supabase.from("learning_quizzes").select("id,title,question_count,generation_status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(3),
  ]);

  if (materialCountResult.error) logger.warn("Learner material count unavailable", { code: materialCountResult.error.code });
  if (analyzedCountResult.error) logger.warn("Learner analysed material count unavailable", { code: analyzedCountResult.error.code });
  if (quizCountResult.error) logger.warn("Learner quiz count unavailable", { code: quizCountResult.error.code });
  if (readyQuizCountResult.error) logger.warn("Learner ready quiz count unavailable", { code: readyQuizCountResult.error.code });
  if (examCountResult.error) logger.warn("Learner exam count unavailable", { code: examCountResult.error.code });
  if (attemptsResult.error) logger.warn("Learner recent exam scores unavailable", { code: attemptsResult.error.code });
  if (activeResult.error) logger.warn("Learner active examination unavailable", { code: activeResult.error.code });
  if (documentsResult.error) logger.warn("Learner recent materials unavailable", { code: documentsResult.error.code });
  if (quizzesResult.error) logger.warn("Learner recent quizzes unavailable", { code: quizzesResult.error.code });

  const parsedAttempts = attemptsResult.error
    ? null
    : checkedRows("quiz_attempts", attemptsResult.data, attemptSchema);
  const parsedActiveAttempts = activeResult.error
    ? null
    : checkedRows("quiz_attempts", activeResult.data, activeAttemptSchema);
  const parsedDocuments = documentsResult.error
    ? null
    : checkedRows("learning_documents", documentsResult.data, documentSchema);
  const parsedQuizzes = quizzesResult.error
    ? null
    : checkedRows("learning_quizzes", quizzesResult.data, quizSchema);
  const recentAttempts = parsedAttempts ?? [];
  const active = parsedActiveAttempts?.[0];
  let activeAttempt: DashboardOverview["activeAttempt"] = null;
  if (active) {
    const { data: quiz, error } = await supabase
      .from("learning_quizzes")
      .select("title")
      .eq("id", active.quiz_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) logger.warn("Active learner quiz title unavailable", { code: error.code });
    activeAttempt = { ...active, quizTitle: quiz?.title ?? "Your examination" };
  }

  return {
    materialCount: materialCountResult.error ? null : materialCountResult.count,
    analyzedMaterialCount: analyzedCountResult.error ? null : analyzedCountResult.count,
    quizCount: quizCountResult.error ? null : quizCountResult.count,
    readyQuizCount: readyQuizCountResult.error ? null : readyQuizCountResult.count,
    completedExamCount: examCountResult.error ? null : examCountResult.count,
    recentAverage: recentAttempts.length
      ? Math.round(recentAttempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / recentAttempts.length)
      : null,
    attemptsAvailable: parsedAttempts !== null,
    activeAttemptAvailable: parsedActiveAttempts !== null,
    documentsAvailable: parsedDocuments !== null,
    quizzesAvailable: parsedQuizzes !== null,
    recentAttempts,
    recentDocuments: parsedDocuments ?? [],
    recentQuizzes: parsedQuizzes ?? [],
    activeAttempt,
  };
}
