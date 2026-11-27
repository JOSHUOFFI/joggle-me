import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { Examination } from "@/components/examination";
import { requireRole } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { examQuestionViewsSchema, parseAttemptRpcResult } from "@/lib/exams/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function ExaminationPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { supabase, user } = await requireRole(["learner"]);
  const { attemptId } = await params;
  const parsedAttemptId = z.uuid().safeParse(attemptId);
  if (!parsedAttemptId.success) notFound();

  const { data: attemptData, error: attemptError } = await supabase.rpc(
    "get_quiz_attempt_state",
    { p_attempt_id: parsedAttemptId.data },
  );
  const attempt = parseAttemptRpcResult(attemptData);
  if (attemptError || !attempt) {
    if (attemptError && attemptError.code !== "42501") {
      logger.error("Examination attempt could not be loaded", {
        code: attemptError.code ?? null,
      });
    }
    notFound();
  }
  if (attempt.status === "submitted") {
    redirect(`/dashboard/exams/${attempt.attempt_id}/results`);
  }

  const { data: quiz, error: quizError } = await supabase
    .from("learning_quizzes")
    .select(
      "id,title,source_document_id,question_count,duration_minutes,generation_status",
    )
    .eq("id", attempt.quiz_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (quizError || !quiz || quiz.generation_status !== "ready") notFound();

  const [{ data: document }, admin] = await Promise.all([
    supabase
      .from("learning_documents")
      .select("original_filename")
      .eq("id", quiz.source_document_id)
      .maybeSingle(),
    Promise.resolve().then(() => createAdminSupabaseClient()),
  ]);
  const { data: questionRow, error: questionError } = await admin
    .from("learning_quizzes")
    .select("questions")
    .eq("id", quiz.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const questions = examQuestionViewsSchema.safeParse(questionRow?.questions);
  if (
    questionError ||
    !questions.success ||
    questions.data.length !== attempt.question_count ||
    quiz.question_count !== attempt.question_count
  ) {
    logger.error("Examination questions could not be validated", {
      quizId: quiz.id,
      code: questionError?.code ?? null,
    });
    notFound();
  }

  return (
    <AppShell>
      <Examination
        initialState={attempt}
        questions={questions.data}
        quizTitle={quiz.title}
        sourceFilename={document?.original_filename ?? "Learning material"}
      />
    </AppShell>
  );
}
