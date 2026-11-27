import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { QuizLibrary, type QuizLibraryEntry } from "@/components/quiz-library";
import { requireRole } from "@/lib/auth";

export default async function MyQuizzesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const { supabase, user } = await requireRole(["learner"]);
  const params = await searchParams;
  const { data: rows, error: quizError } = await supabase
    .from("learning_quizzes")
    .select(
      "id,title,source_document_id,question_count,difficulty,duration_minutes,generation_status,selected_topics,created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  let quizzes: QuizLibraryEntry[] = [];
  let loadError = Boolean(quizError);
  if (!quizError && rows?.length) {
    const documentIds = [...new Set(rows.map((quiz) => quiz.source_document_id))];
    const { data: documents, error: documentError } = await supabase
      .from("learning_documents")
      .select("id,original_filename")
      .in("id", documentIds);
    if (documentError) {
      loadError = true;
    } else {
      const fileNames = new Map(
        (documents ?? []).map((document) => [document.id, document.original_filename]),
      );
      quizzes = rows.map((quiz) => ({
        ...quiz,
        source_filename: fileNames.get(quiz.source_document_id) ?? "Learning material",
      }));
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#7655D9]">Your library</p>
          <h1 className="mt-1 text-3xl font-black text-[#17152A]">My Quizzes</h1>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#DDD8EF] bg-white px-4 text-sm font-semibold text-[#35216B] hover:bg-[#F7F7FC]"
        >
          Browse learning materials
        </Link>
      </div>
      {params.deleted && (
        <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          Quiz deleted.
        </p>
      )}
      <QuizLibrary
        quizzes={quizzes}
        error={
          params.error
            ? "We couldn’t delete that quiz. Refresh and try again."
            : loadError
              ? "Your quiz library couldn’t be loaded. Please refresh the page."
              : undefined
        }
      />
    </AppShell>
  );
}
