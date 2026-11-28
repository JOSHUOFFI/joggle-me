import Link from "next/link";
import { deleteQuizAction } from "@/lib/actions/quizzes";
import type { requireGuestWorkspace } from "@/lib/guest-workspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type DashboardSupabase = Awaited<
  ReturnType<typeof requireGuestWorkspace>
>["supabase"];

export type QuizLibraryEntry = {
  id: string;
  title: string;
  source_document_id: string;
  source_filename: string;
  question_count: number;
  difficulty: string;
  duration_minutes: number;
  generation_status: string;
  selected_topics: string[];
  created_at: string;
};

export function QuizLibrary({
  quizzes,
  error,
}: {
  quizzes: QuizLibraryEntry[];
  error?: string;
}) {
  return (
    <section aria-labelledby="my-quizzes-heading" className="mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#7655D9]">Your library</p>
          <h2 id="my-quizzes-heading" className="mt-1 text-2xl font-black">
            My Quizzes
          </h2>
        </div>
      </div>
      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {!quizzes.length ? (
        <Card className="p-6 text-sm text-[#77758A]">
          Your generated quizzes will appear here.
        </Card>
      ) : (
        <div className="grid gap-3">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="break-words font-bold text-[#35216B]">{quiz.title}</h3>
                <p className="mt-1 text-sm text-[#77758A]">
                  Source:{" "}
                  <Link
                    className="font-semibold text-[#7655D9] hover:underline"
                    href={`/dashboard/materials/${quiz.source_document_id}`}
                  >
                    {quiz.source_filename || "Learning material"}
                  </Link>
                </p>
                <p className="mt-1 text-xs capitalize text-[#77758A]">
                  {quiz.question_count} questions · {quiz.difficulty} · {quiz.duration_minutes} minutes · {quiz.generation_status}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {quiz.generation_status === "ready" && (
                  <Link
                    href={`/dashboard/quizzes/${quiz.id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#35216B] px-4 text-sm font-semibold text-white hover:bg-[#7655D9]"
                  >
                    Preview
                  </Link>
                )}
                {quiz.generation_status === "failed" && (
                  <Link
                    href={`/dashboard/quizzes/new?documentId=${quiz.source_document_id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#DDD8EF] bg-white px-4 text-sm font-semibold text-[#35216B] hover:bg-[#F7F7FC]"
                  >
                    Try again
                  </Link>
                )}
                <form action={deleteQuizAction}>
                  <input type="hidden" name="quizId" value={quiz.id} />
                  <Button type="submit" variant="danger">Delete</Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export async function QuizDashboardSection({
  supabase,
  userId,
}: {
  supabase: DashboardSupabase;
  userId: string;
}) {
  const { data: quizzes, error } = await supabase
    .from("learning_quizzes")
    .select("id,title,question_count,difficulty,generation_status,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3);

  return (
    <section aria-labelledby="dashboard-quizzes-heading" className="mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#7655D9]">Your library</p>
          <h2 id="dashboard-quizzes-heading" className="mt-1 text-2xl font-black">
            My Quizzes
          </h2>
        </div>
        <Link
          href="/dashboard/quizzes"
          className="text-sm font-semibold text-[#7655D9] hover:underline"
        >
          View all quizzes
        </Link>
      </div>
      {error ? (
        <Card className="p-5 text-sm text-red-700" role="alert">
          Your quiz library couldn’t be loaded. Please refresh the page.
        </Card>
      ) : quizzes?.length ? (
        <div className="grid gap-3">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h3 className="font-bold text-[#35216B]">{quiz.title}</h3>
                <p className="mt-1 text-xs capitalize text-[#77758A]">
                  {quiz.question_count} questions · {quiz.difficulty} · {quiz.generation_status}
                </p>
              </div>
              {quiz.generation_status === "ready" && (
                <Link
                  href={`/dashboard/quizzes/${quiz.id}`}
                  className="text-sm font-semibold text-[#7655D9] hover:underline"
                >
                  Preview
                </Link>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-5 text-sm text-[#77758A]">
          Generate a quiz from an analysed learning material to see it here.
        </Card>
      )}
    </section>
  );
}
