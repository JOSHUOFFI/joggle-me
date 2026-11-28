import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { ProcessingRefresh } from "@/components/learning-materials";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deleteQuizAction } from "@/lib/actions/quizzes";
import { requireGuestWorkspace } from "@/lib/guest-workspace";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { quizQuestionsSchema } from "@/lib/quizzes/types";

type SourceSection = {
  source_id: string;
  title: string;
  page_or_location: string;
};

export default async function QuizPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase, user } = await requireGuestWorkspace();
  const { id } = await params;
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) notFound();

  const { data: quiz, error } = await supabase
    .from("learning_quizzes")
    .select(
      "id,title,source_document_id,question_count,difficulty,duration_minutes,selected_topics,generation_status,created_at",
    )
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !quiz) notFound();

  const { data: document } = await supabase
    .from("learning_documents")
    .select("id,original_filename")
    .eq("id", quiz.source_document_id)
    .eq("user_id", user.id)
    .maybeSingle();
  let questionPayload: unknown = null;
  if (quiz.generation_status === "ready") {
    let admin: ReturnType<typeof createAdminSupabaseClient> | null = null;
    try {
      admin = createAdminSupabaseClient();
    } catch {
      logger.error("Quiz preview question storage is not configured");
    }

    if (admin) {
      const { data: questionRow, error: questionError } = await admin
        .from("learning_quizzes")
        .select("questions")
        .eq("id", quiz.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (questionError || !questionRow) {
        logger.error("Quiz preview questions could not be loaded", {
          quizId: quiz.id,
          code: questionError?.code ?? null,
        });
      } else {
        questionPayload = questionRow.questions;
      }
    }
  }
  const questionResult =
    quiz.generation_status === "ready"
      ? quizQuestionsSchema.safeParse(questionPayload)
      : null;
  const sourceIds = questionResult?.success
    ? [...new Set(questionResult.data.flatMap((question) => question.sourceRefs))]
    : [];
  let sourceIndex = new Map<string, SourceSection>();
  if (sourceIds.length) {
    const { data: sources } = await supabase
      .from("document_sections")
      .select("source_id,title,page_or_location")
      .eq("document_id", quiz.source_document_id)
      .eq("user_id", user.id)
      .in("source_id", sourceIds);
    sourceIndex = new Map(
      (sources ?? []).map((source) => [source.source_id, source]),
    );
  }

  const ready =
    quiz.generation_status === "ready" &&
    questionResult?.success === true &&
    questionResult.data.length === quiz.question_count;

  return (
    <AppShell>
      <ProcessingRefresh active={quiz.generation_status === "generating"} />
      <Link
        href="/dashboard/quizzes"
        className="text-sm font-bold text-[#7655D9] hover:underline"
      >
        ← Back to My Quizzes
      </Link>
      <div className="mb-6 mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#7655D9]">Quiz preview</p>
          <h1 className="mt-1 break-words text-3xl font-black text-[#17152A]">
            {quiz.title}
          </h1>
        </div>
        <form action={deleteQuizAction}>
          <input type="hidden" name="quizId" value={quiz.id} />
          <Button type="submit" variant="danger">Delete quiz</Button>
        </form>
      </div>

      <Card className="mb-6 p-5 sm:p-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="font-bold text-[#35216B]">Source document</dt>
            <dd className="mt-1">
              {document ? (
                <Link
                  className="text-[#7655D9] hover:underline"
                  href={`/dashboard/materials/${document.id}`}
                >
                  {document.original_filename}
                </Link>
              ) : "Learning material"}
            </dd>
          </div>
          <div><dt className="font-bold text-[#35216B]">Questions</dt><dd className="mt-1">{quiz.question_count}</dd></div>
          <div><dt className="font-bold text-[#35216B]">Difficulty</dt><dd className="mt-1 capitalize">{quiz.difficulty}</dd></div>
          <div><dt className="font-bold text-[#35216B]">Duration</dt><dd className="mt-1">{quiz.duration_minutes} minutes</dd></div>
          <div className="sm:col-span-2"><dt className="font-bold text-[#35216B]">Topics</dt><dd className="mt-1">{quiz.selected_topics.join(", ")}</dd></div>
        </dl>
      </Card>
      {ready && (
        <Link
          href={`/dashboard/quizzes/${quiz.id}/exam`}
          className="mb-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#35216B] px-5 text-sm font-semibold text-white hover:bg-[#7655D9]"
        >
          Start examination
        </Link>
      )}

      {quiz.generation_status === "generating" && (
        <Card className="p-6">
          <p className="text-sm text-[#4E4B60]" role="status">
            Your quiz is still being generated. This page will refresh automatically.
          </p>
        </Card>
      )}
      {quiz.generation_status === "failed" && (
        <Card className="p-6">
          <p className="text-sm text-red-700" role="alert">
            Quiz generation did not complete. Try again with the same document.
          </p>
          <Link
            href={`/dashboard/quizzes/new?documentId=${quiz.source_document_id}`}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#35216B] px-4 text-sm font-semibold text-white hover:bg-[#7655D9]"
          >
            Generate another quiz
          </Link>
        </Card>
      )}
      {quiz.generation_status === "ready" && !ready && (
        <Card className="p-6">
          <p className="text-sm text-red-700" role="alert">
            The saved questions are incomplete or invalid. Generate a new quiz.
          </p>
        </Card>
      )}
      {ready && questionResult?.success && (
        <div className="space-y-4">
          {questionResult.data.map((question, index) => (
            <Card key={`${index}-${question.question}`} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="max-w-4xl font-bold leading-6 text-[#35216B]">
                  {index + 1}. {question.question}
                </h2>
                <span className="rounded-full bg-[#F0ECFB] px-3 py-1 text-xs font-semibold capitalize text-[#35216B]">
                  {question.difficulty}
                </span>
              </div>
              <p className="mt-2 text-xs text-[#77758A]">Topic: {question.topic}</p>
              <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                {question.options
                  .slice()
                  .sort((first, second) => first.label.localeCompare(second.label))
                  .map((option) => (
                    <li
                      key={option.label}
                      className="rounded-xl border border-[#ECEAF5] px-4 py-3 text-sm text-[#4E4B60]"
                    >
                      <span className="mr-2 font-bold text-[#7655D9]">{option.label}.</span>
                      {option.text}
                    </li>
                  ))}
              </ol>
              <p className="mt-4 text-xs text-[#77758A]">
                Sources:{" "}
                {question.sourceRefs.map((sourceId) => {
                  const source = sourceIndex.get(sourceId);
                  return source
                    ? `${source.page_or_location} — ${source.title}`
                    : sourceId;
                }).join("; ")}
              </p>
            </Card>
          ))}
          <p className="text-xs text-[#77758A]">
            This preview does not show correct answers. Start an examination when you are ready.
          </p>
          <Link
            href={`/dashboard/quizzes/new?documentId=${quiz.source_document_id}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#DDD8EF] bg-white px-4 text-sm font-semibold text-[#35216B] hover:bg-[#F7F7FC]"
          >
            Regenerate quiz
          </Link>
        </div>
      )}
    </AppShell>
  );
}
