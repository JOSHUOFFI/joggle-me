import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { QuizConfiguration } from "@/components/quiz-configuration";
import { Card } from "@/components/ui/card";
import { requireGuestWorkspace } from "@/lib/guest-workspace";
import { isFeatureEnabled } from "@/lib/features";
import { documentAnalysisSchema } from "@/lib/materials/types";

export default async function NewQuizPage({
  searchParams,
}: {
  searchParams: Promise<{ documentId?: string }>;
}) {
  const { supabase, user } = await requireGuestWorkspace();
  const { documentId } = await searchParams;

  const [quizEnabled, analysisEnabled, uploadsEnabled] = await Promise.all([
    isFeatureEnabled(supabase, "ai_quiz_generation"),
    isFeatureEnabled(supabase, "ai_document_analysis"),
    isFeatureEnabled(supabase, "learning_material_uploads"),
  ]);

  if (!documentId) {
    const { data: documents, error } = await supabase
      .from("learning_documents")
      .select("id,original_filename,analysis")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .eq("analysis_status", "ready")
      .order("created_at", { ascending: false });
    const availableDocuments = (documents ?? []).filter((document) => {
      const analysis = documentAnalysisSchema.safeParse(document.analysis);
      return analysis.success && analysis.data.topics.length > 0;
    });

    return (
      <AppShell>
        <div className="mb-6">
          <p className="text-sm font-bold text-[#7655D9]">Quiz setup</p>
          <h1 className="mt-1 text-3xl font-black text-[#17152A]">Generate Quiz</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#77758A]">
            Choose an analysed learning material to build a quiz from.
          </p>
        </div>
        {!quizEnabled ? (
          <Card className="p-6 text-sm leading-6 text-[#4E4B60]" role="status">
            AI quiz generation is currently disabled. Ask the platform owner to enable it.
          </Card>
        ) : !analysisEnabled || !uploadsEnabled ? (
          <Card className="p-6 text-sm leading-6 text-[#4E4B60]" role="status">
            Learning material analysis is currently disabled.
          </Card>
        ) : error ? (
          <Card className="p-6 text-sm leading-6 text-red-700" role="alert">
            Your analysed learning materials could not be loaded. Please refresh and try again.
          </Card>
        ) : availableDocuments.length ? (
          <div className="grid gap-3">
            {availableDocuments.map((document) => {
              const analysis = documentAnalysisSchema.parse(document.analysis);
              return (
                <Card key={document.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <h2 className="font-bold text-[#35216B]">
                      {analysis.title || document.original_filename}
                    </h2>
                    <p className="mt-1 text-sm text-[#77758A]">
                      {analysis.topics.length} analysed {analysis.topics.length === 1 ? "topic" : "topics"}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/quizzes/new?documentId=${document.id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#7655D9] px-4 text-sm font-semibold text-white hover:bg-[#6041C1]"
                  >
                    Use this material
                  </Link>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-6">
            <p className="text-sm leading-6 text-[#4E4B60]" role="status">
              No analysed learning materials are ready for quiz generation yet. Upload a material and wait for its analysis to complete.
            </p>
            <Link
              href="/dashboard/materials"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#7655D9] px-4 text-sm font-semibold text-white hover:bg-[#6041C1]"
            >
              Go to Learning Materials
            </Link>
          </Card>
        )}
      </AppShell>
    );
  }

  const { data: document, error } = await supabase
    .from("learning_documents")
    .select("id,original_filename,status,analysis_status,analysis")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !document) notFound();

  const analysis = documentAnalysisSchema.safeParse(document.analysis);
  const topics = analysis.success
    ? [...new Set(analysis.data.topics.flatMap((topic) => [
        topic.name,
        ...topic.subtopics,
      ]).filter((topic, index, list) =>
        list.findIndex((other) => other.toLocaleLowerCase() === topic.toLocaleLowerCase()) === index,
      ))]
    : [];
  const canGenerate =
    quizEnabled &&
    analysisEnabled &&
    uploadsEnabled &&
    document.status === "ready" &&
    document.analysis_status === "ready" &&
    analysis.success &&
    topics.length > 0;

  return (
    <AppShell>
      <Link
        href={`/dashboard/materials/${document.id}`}
        className="text-sm font-bold text-[#7655D9] hover:underline"
      >
        ← Back to document analysis
      </Link>
      <div className="mb-6 mt-5">
        <p className="text-sm font-bold text-[#7655D9]">Quiz setup</p>
        <h1 className="mt-1 text-3xl font-black text-[#17152A]">Generate Quiz</h1>
      </div>
      {canGenerate && analysis.success ? (
        <QuizConfiguration
          documentId={document.id}
          documentTitle={analysis.data.title}
          topics={topics}
        />
      ) : (
        <Card className="p-6">
          <p className="text-sm leading-6 text-[#4E4B60]" role="status">
            {!quizEnabled
              ? "AI quiz generation is currently disabled. Ask the platform owner to enable it."
              : !analysisEnabled || !uploadsEnabled
                ? "Learning material analysis is currently disabled."
                : "This document must have a completed analysis before a quiz can be generated."}
          </p>
        </Card>
      )}
    </AppShell>
  );
}
