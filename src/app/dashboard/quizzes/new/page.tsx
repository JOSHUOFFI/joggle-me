import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { QuizConfiguration } from "@/components/quiz-configuration";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/features";
import { documentAnalysisSchema } from "@/lib/materials/types";

export default async function NewQuizPage({
  searchParams,
}: {
  searchParams: Promise<{ documentId?: string }>;
}) {
  const { supabase } = await requireRole(["learner"]);
  const { documentId } = await searchParams;
  if (!documentId) notFound();

  const { data: document, error } = await supabase
    .from("learning_documents")
    .select("id,original_filename,status,analysis_status,analysis")
    .eq("id", documentId)
    .maybeSingle();
  if (error || !document) notFound();

  const analysis = documentAnalysisSchema.safeParse(document.analysis);
  const [quizEnabled, analysisEnabled, uploadsEnabled] = await Promise.all([
    isFeatureEnabled(supabase, "ai_quiz_generation"),
    isFeatureEnabled(supabase, "ai_document_analysis"),
    isFeatureEnabled(supabase, "learning_material_uploads"),
  ]);
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
