import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { ExamStartButton } from "@/components/exam-start-button";
import { Card } from "@/components/ui/card";
import { requireGuestWorkspace } from "@/lib/guest-workspace";
import { isFeatureEnabled } from "@/lib/features";

export default async function ExaminationInstructionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase, user } = await requireGuestWorkspace();
  const { id } = await params;
  const quizId = z.uuid().safeParse(id);
  if (!quizId.success) notFound();

  const { data: quiz, error } = await supabase
    .from("learning_quizzes")
    .select(
      "id,title,source_document_id,question_count,difficulty,duration_minutes,selected_topics,generation_status",
    )
    .eq("id", quizId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !quiz || quiz.generation_status !== "ready") notFound();

  const [{ data: document }, examinationEnabled] = await Promise.all([
    supabase
      .from("learning_documents")
      .select("id,original_filename")
      .eq("id", quiz.source_document_id)
      .eq("user_id", user.id)
      .maybeSingle(),
    isFeatureEnabled(supabase, "examination_functionality"),
  ]);

  return (
    <AppShell>
      <Link
        href={`/dashboard/quizzes/${quiz.id}`}
        className="text-sm font-bold text-[#7655D9] hover:underline"
      >
        ← Back to quiz preview
      </Link>
      <div className="mb-6 mt-5">
        <p className="text-sm font-bold text-[#7655D9]">Examination instructions</p>
        <h1 className="mt-1 break-words text-3xl font-black text-[#17152A]">
          {quiz.title}
        </h1>
      </div>

      <Card className="mb-6 p-5 sm:p-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="font-bold text-[#35216B]">Source document</dt>
            <dd className="mt-1">{document?.original_filename ?? "Learning material"}</dd>
          </div>
          <div>
            <dt className="font-bold text-[#35216B]">Questions</dt>
            <dd className="mt-1">{quiz.question_count}</dd>
          </div>
          <div>
            <dt className="font-bold text-[#35216B]">Difficulty</dt>
            <dd className="mt-1 capitalize">{quiz.difficulty}</dd>
          </div>
          <div>
            <dt className="font-bold text-[#35216B]">Duration</dt>
            <dd className="mt-1">{quiz.duration_minutes} minutes</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-bold text-[#35216B]">Topics covered</dt>
            <dd className="mt-1">{quiz.selected_topics.join(", ")}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-xl font-bold text-[#35216B]">Before you begin</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-[#4E4B60]">
          <li>Answer each multiple-choice question by selecting one option.</li>
          <li>Use Previous, Next, or the question numbers to move around.</li>
          <li>Your answers are saved automatically and can be restored if you reconnect.</li>
          <li>The server-set timer continues if you refresh or leave this page.</li>
          <li>The examination submits automatically when time expires. You cannot change answers after submission.</li>
          <li>You can submit early after reviewing the answered and unanswered question counts.</li>
        </ul>
        <p className="mt-4 text-sm font-semibold text-[#35216B]">
          Results include your score and a question-by-question review after submission.
        </p>
        <div className="mt-6">
          {examinationEnabled ? (
            <ExamStartButton quizId={quiz.id} />
          ) : (
            <p className="text-sm text-[#77758A]" role="status">
              Examinations are currently unavailable. Please try again later.
            </p>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
