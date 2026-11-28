import Link from "next/link";
import { ArrowRight, BookOpenCheck, FileText, Sparkles } from "lucide-react";
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
        <section className="experience-page quiz-experience">
          <header className="experience-page-header">
            <span className="experience-mark"><Sparkles size={22} aria-hidden="true" /></span>
            <div>
              <p className="experience-kicker">AI quiz generator · Step 1 of 2</p>
              <h1 className="experience-title">Choose your study material</h1>
              <p className="experience-description">
                Start with an analysed document. You can choose the topics and quiz format next.
              </p>
            </div>
          </header>
        {!quizEnabled ? (
          <Card className="experience-card p-6 text-sm leading-6 text-[#4E4B60]" role="status">
            AI quiz generation is currently disabled. Ask the platform owner to enable it.
          </Card>
        ) : !analysisEnabled || !uploadsEnabled ? (
          <Card className="experience-card p-6 text-sm leading-6 text-[#4E4B60]" role="status">
            Learning material analysis is currently disabled.
          </Card>
        ) : error ? (
          <Card className="experience-card p-6 text-sm leading-6 text-red-700" role="alert">
            Your analysed learning materials could not be loaded. Please refresh and try again.
          </Card>
        ) : availableDocuments.length ? (
          <section aria-label="Analysed learning materials" className="grid gap-3">
            {availableDocuments.map((document) => {
              const analysis = documentAnalysisSchema.parse(document.analysis);
              return (
                <Card key={document.id} className="experience-card quiz-document-card">
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="quiz-document-icon"><FileText size={21} aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <h2 className="break-words text-base font-bold text-[#35216B]">
                        {analysis.title || document.original_filename}
                      </h2>
                      <p className="mt-1 text-sm text-[#77758A]">
                        {analysis.topics.length} analysed {analysis.topics.length === 1 ? "topic" : "topics"}
                        <span className="mx-2" aria-hidden="true">·</span>
                        <span className="break-all">{document.original_filename}</span>
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/quizzes/new?documentId=${document.id}`}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#7655D9] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#6041C1] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7655D9]/25"
                  >
                    Configure quiz <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </Card>
              );
            })}
          </section>
        ) : (
          <Card className="experience-card p-6 sm:p-7">
            <span className="quiz-document-icon"><BookOpenCheck size={22} aria-hidden="true" /></span>
            <h2 className="mt-4 text-lg font-bold text-[#35216B]">No ready materials yet</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4E4B60]" role="status">
              Analysed learning materials will appear here when they are ready. Upload a study document to get started.
            </p>
            <Link
              href="/dashboard/materials"
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#7655D9] px-4 text-sm font-semibold text-white hover:bg-[#6041C1] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7655D9]/25"
            >
              <FileText size={16} aria-hidden="true" /> Go to Learning Materials
            </Link>
          </Card>
        )}
        </section>
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
      <section className="experience-page quiz-experience">
      <Link
        href={`/dashboard/materials/${document.id}`}
        className="experience-back-link"
      >
        ← Back to document analysis
      </Link>
      <header className="experience-page-header mt-3">
        <span className="experience-mark"><Sparkles size={22} aria-hidden="true" /></span>
        <div>
          <p className="experience-kicker">AI quiz generator · Step 2 of 2</p>
          <h1 className="experience-title">Configure your quiz</h1>
          <p className="experience-description">
            Choose the topics and format that fit your next study session.
          </p>
        </div>
      </header>
      {canGenerate && analysis.success ? (
        <QuizConfiguration
          documentId={document.id}
          documentTitle={analysis.data.title}
          topics={topics}
        />
      ) : (
        <Card className="experience-card p-6">
          <p className="text-sm leading-6 text-[#4E4B60]" role="status">
            {!quizEnabled
              ? "AI quiz generation is currently disabled. Ask the platform owner to enable it."
              : !analysisEnabled || !uploadsEnabled
                ? "Learning material analysis is currently disabled."
                : "This document must have a completed analysis before a quiz can be generated."}
          </p>
        </Card>
      )}
      </section>
    </AppShell>
  );
}
