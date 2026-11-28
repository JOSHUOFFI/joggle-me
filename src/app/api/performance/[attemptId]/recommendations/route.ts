import { z } from "zod";
import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { documentAnalysisSchema } from "@/lib/materials/types";
import {
  buildQuestionReviews,
  buildTopicPerformance,
} from "@/lib/performance/analytics";
import {
  generatePerformanceRecommendations,
  persistedRecommendationsSchema,
  geminiPerformanceRecommendationProvider,
} from "@/lib/performance/recommendations";
import {
  getOwnedQuizQuestions,
  PerformanceDataError,
} from "@/lib/performance/data";
import {
  examJson,
  getExamLearnerContext,
  isSameOriginExamRequest,
} from "@/lib/exams/request";
import { parseAttemptRpcResult } from "@/lib/exams/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ attemptId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginExamRequest(request)) {
    return examJson({ message: "The recommendation request origin could not be verified." }, 403);
  }

  const learner = await getExamLearnerContext();
  if (!learner.ok) return learner.response;

  const { attemptId } = await context.params;
  const parsedAttemptId = z.uuid().safeParse(attemptId);
  if (!parsedAttemptId.success) {
    return examJson({ message: "The completed examination could not be found." }, 404);
  }

  const { data: attemptData, error: attemptError } = await learner.supabase.rpc(
    "guest_get_quiz_attempt_state",
    {
      p_token_hash: learner.user.guestTokenHash,
      p_attempt_id: parsedAttemptId.data,
    },
  );
  const attempt = parseAttemptRpcResult(attemptData);
  if (attemptError || !attempt) {
    if (attemptError && attemptError.code !== "42501") {
      logger.error("Recommendation attempt verification failed", {
        code: attemptError.code ?? null,
      });
    }
    return examJson({ message: "The completed examination could not be loaded." }, 404);
  }
  if (attempt.status !== "submitted") {
    return examJson({ message: "Recommendations are available after submission." }, 409);
  }

  const { data: quiz, error: quizError } = await learner.supabase
    .from("learning_quizzes")
    .select("id,source_document_id")
    .eq("id", attempt.quiz_id)
    .eq("user_id", learner.user.id)
    .maybeSingle();
  if (quizError || !quiz) {
    logger.error("Recommendation quiz ownership could not be verified", {
      code: quizError?.code ?? null,
    });
    return examJson({ message: "The source quiz could not be verified." }, 404);
  }

  let admin: ReturnType<typeof createAdminSupabaseClient>;
  try {
    admin = createAdminSupabaseClient();
  } catch {
    logger.error("Recommendation persistence is not configured");
    return examJson({ message: "Recommendations are temporarily unavailable." }, 503);
  }

  const { data: storedData, error: storedError } = await learner.supabase
    .from("exam_performance_recommendations")
    .select("generation_status,recommendations,generated_at,updated_at")
    .eq("attempt_id", attempt.attempt_id)
    .eq("user_id", learner.user.id)
    .maybeSingle();
  if (storedError) {
    logger.error("Stored recommendations could not be loaded", {
      code: storedError.code ?? null,
    });
    return examJson({ message: "Saved recommendations could not be loaded." }, 503);
  }
  const stored = persistedRecommendationsSchema.safeParse(storedData);
  if (stored.success && stored.data.generation_status === "ready") {
    return examJson({
      generationStatus: stored.data.generation_status,
      recommendations: stored.data.recommendations,
      generatedAt: stored.data.generated_at,
    });
  }
  if (storedData && !stored.success) {
    logger.error("Stored recommendations failed validation", {
      attemptId: attempt.attempt_id,
    });
  }

  const { data: document, error: documentError } = await learner.supabase
    .from("learning_documents")
    .select("original_filename,analysis")
    .eq("id", quiz.source_document_id)
    .eq("user_id", learner.user.id)
    .maybeSingle();
  const analysis = documentAnalysisSchema.safeParse(document?.analysis);
  if (documentError || !document || !analysis.success) {
    logger.error("Recommendation source analysis could not be validated", {
      code: documentError?.code ?? null,
      documentId: quiz.source_document_id,
    });
    return examJson({ message: "The analysed source material is unavailable." }, 409);
  }

  let questions;
  try {
    questions = await getOwnedQuizQuestions(
      learner.user.id,
      quiz.id,
      attempt.question_count,
    );
  } catch (error) {
    if (!(error instanceof PerformanceDataError)) throw error;
    return examJson({ message: error.message }, 503);
  }

  const questionReviews = buildQuestionReviews(questions, attempt.answers);
  const computedResults = {
    correctCount: questionReviews.filter((question) => question.outcome === "correct").length,
    incorrectCount: questionReviews.filter((question) => question.outcome === "incorrect").length,
    unansweredCount: questionReviews.filter((question) => question.outcome === "unanswered").length,
  };
  if (
    computedResults.correctCount !== attempt.correct_count ||
    computedResults.incorrectCount !== attempt.incorrect_count ||
    computedResults.unansweredCount !== attempt.unanswered_count
  ) {
    logger.error("Recommendation inputs do not match the finalized result", {
      attemptId: attempt.attempt_id,
    });
    return examJson({ message: "Recommendations could not be verified against this result." }, 409);
  }

  const sourceIds = [...new Set(questionReviews.flatMap((question) => question.sourceRefs))];
  const { data: sourceRows, error: sourcesError } = await learner.supabase
    .from("document_sections")
    .select("source_id,title,page_or_location")
    .eq("document_id", quiz.source_document_id)
    .eq("user_id", learner.user.id)
    .in("source_id", sourceIds);
  if (sourcesError) {
    logger.error("Recommendation source references could not be loaded", {
      code: sourcesError.code ?? null,
    });
    return examJson({ message: "Source references could not be loaded." }, 503);
  }

  const validSourceIds = new Set((sourceRows ?? []).map((source) => source.source_id));
  if (sourceIds.some((sourceId) => !validSourceIds.has(sourceId))) {
    logger.error("A recommendation source reference is missing from its document", {
      attemptId: attempt.attempt_id,
    });
    return examJson({ message: "Some source references are unavailable." }, 409);
  }

  const topics = buildTopicPerformance([{
    attemptId: attempt.attempt_id,
    subject: analysis.data.subject,
    questions,
    answers: attempt.answers,
  }]);
  const result = await generatePerformanceRecommendations(
    geminiPerformanceRecommendationProvider,
    {
      documentTitle: analysis.data.title,
      subject: analysis.data.subject,
      overallPercentage: attempt.percentage ?? 0,
      correctCount: computedResults.correctCount,
      incorrectCount: computedResults.incorrectCount,
      unansweredCount: computedResults.unansweredCount,
      topics,
      questionReviews,
      analysis: analysis.data,
      sources: (sourceRows ?? []).map((source) => ({
        sourceId: source.source_id,
        title: source.title,
        pageOrLocation: source.page_or_location,
      })),
    },
  );

  const now = new Date().toISOString();
  const { error: saveError } = await admin
    .from("exam_performance_recommendations")
    .upsert(
      {
        attempt_id: attempt.attempt_id,
        user_id: learner.user.id,
        generation_status: result.generationStatus,
        recommendations: result.recommendations,
        generated_at: now,
        updated_at: now,
      },
      { onConflict: "attempt_id" },
    );
  if (saveError) {
    logger.error("Performance recommendations could not be persisted", {
      code: saveError.code ?? null,
    });
    return examJson({ message: "Recommendations could not be saved. Please retry." }, 503);
  }

  return examJson({
    generationStatus: result.generationStatus,
    recommendations: result.recommendations,
    generatedAt: now,
  });
}
