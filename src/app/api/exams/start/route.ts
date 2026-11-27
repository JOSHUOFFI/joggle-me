import { z } from "zod";
import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import {
  examQuestionViewsSchema,
  parseAttemptRpcResult,
} from "@/lib/exams/types";
import {
  examJson,
  getExamLearnerContext,
  isSameOriginExamRequest,
} from "@/lib/exams/request";

const requestSchema = z.object({ quizId: z.uuid() });

export async function POST(request: NextRequest) {
  if (!isSameOriginExamRequest(request)) {
    return examJson({ message: "The examination request origin could not be verified." }, 403);
  }

  const context = await getExamLearnerContext();
  if (!context.ok) return context.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return examJson({ message: "The quiz selection could not be read." }, 400);
  }
  const parsedBody = requestSchema.safeParse(body);
  if (!parsedBody.success) {
    return examJson({ message: "Choose a valid quiz to start." }, 400);
  }

  const { data, error } = await context.supabase.rpc("start_quiz_attempt", {
    p_quiz_id: parsedBody.data.quizId,
  });
  if (error) {
    if (error.code === "42501") {
      return examJson({ message: "That ready quiz could not be found." }, 404);
    }
    if (error.code === "55000") {
      return examJson({ message: "Examinations are currently unavailable." }, 503);
    }
    logger.error("Examination attempt could not be started", {
      code: error.code ?? null,
    });
    return examJson({ message: "We couldn’t start the examination. Please retry." }, 503);
  }

  const attempt = parseAttemptRpcResult(data);
  if (!attempt) {
    logger.error("Examination start returned invalid attempt data");
    return examJson({ message: "The examination could not be loaded. Please retry." }, 503);
  }
  if (attempt.status === "submitted") {
    return examJson({ state: attempt }, 200);
  }

  let admin: ReturnType<typeof createAdminSupabaseClient>;
  try {
    admin = createAdminSupabaseClient();
  } catch {
    logger.error("Examination question storage is not configured");
    return examJson({ message: "Examination questions are temporarily unavailable." }, 503);
  }

  const { data: quiz, error: quizError } = await admin
    .from("learning_quizzes")
    .select("question_count,questions")
    .eq("id", attempt.quiz_id)
    .eq("user_id", context.user.id)
    .eq("generation_status", "ready")
    .maybeSingle();
  if (quizError || !quiz) {
    logger.error("Examination questions could not be loaded", {
      code: quizError?.code ?? null,
    });
    return examJson({ message: "Examination questions are temporarily unavailable." }, 503);
  }

  const questions = examQuestionViewsSchema.safeParse(quiz.questions);
  if (
    !questions.success ||
    questions.data.length !== attempt.question_count ||
    quiz.question_count !== attempt.question_count
  ) {
    logger.error("Saved examination questions failed validation", {
      quizId: attempt.quiz_id,
    });
    return examJson({ message: "The saved examination questions are incomplete." }, 409);
  }

  return examJson({ state: attempt, questions: questions.data }, 201);
}
