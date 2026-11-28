import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { ProcessingRefresh } from "@/components/learning-materials";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { retryLearningDocumentAction } from "@/lib/actions/materials";
import { requireGuestWorkspace } from "@/lib/guest-workspace";
import { documentAnalysisSchema } from "@/lib/materials/types";
import { isFeatureEnabled } from "@/lib/features";

type Citation = {
  sourceId: string;
  title: string;
  pageOrLocation: string;
};

function Citations({
  references,
  sourceIndex,
}: {
  references: string[];
  sourceIndex: Map<string, Citation>;
}) {
  const citations = references
    .map((reference) => sourceIndex.get(reference))
    .filter((citation): citation is Citation => Boolean(citation));

  if (!citations.length) return null;
  return (
    <p className="mt-2 text-xs text-[#77758A]">
      Sources:{" "}
      {citations
        .map((citation) => `${citation.pageOrLocation} — ${citation.title}`)
        .join("; ")}
    </p>
  );
}

export default async function DocumentAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase, user } = await requireGuestWorkspace();
  const { id } = await params;
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) notFound();

  const { data: document, error: documentError } = await supabase
    .from("learning_documents")
    .select(
      "id,original_filename,file_type,status,extraction_status,analysis_status,analysis,analysis_model,created_at,error_message",
    )
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (documentError) {
    return (
      <AppShell>
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          We couldn’t load this document. Please refresh the page.
        </p>
      </AppShell>
    );
  }
  if (!document) notFound();

  const { data: sections, error: sectionsError } = await supabase
    .from("document_sections")
    .select("source_id,title,page_or_location")
    .eq("document_id", parsedId.data)
    .eq("user_id", user.id)
    .order("position");
  if (sectionsError) {
    return (
      <AppShell>
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          We couldn’t load the source references for this document. Please refresh the page.
        </p>
      </AppShell>
    );
  }

  const isProcessing =
    document.status === "queued" || document.status === "processing";
  const analysis = documentAnalysisSchema.safeParse(document.analysis);
  const sourceIndex = new Map(
    (sections ?? []).map((section) => [
      section.source_id,
      {
        sourceId: section.source_id,
        title: section.title,
        pageOrLocation: section.page_or_location,
      },
    ]),
  );
  const quizFeaturesEnabled =
    document.status === "ready" &&
    analysis.success &&
    (await Promise.all([
      isFeatureEnabled(supabase, "ai_quiz_generation"),
      isFeatureEnabled(supabase, "ai_document_analysis"),
      isFeatureEnabled(supabase, "learning_material_uploads"),
    ])).every(Boolean);

  return (
    <AppShell>
      <ProcessingRefresh active={isProcessing} />
      <Link
        href="/dashboard"
        className="text-sm font-bold text-[#7655D9] hover:underline"
      >
        ← Back to learning materials
      </Link>
      <div className="mb-6 mt-5">
        <p className="text-sm font-bold text-[#7655D9]">Document analysis</p>
        <h1 className="mt-1 break-words text-3xl font-black text-[#17152A]">
          {analysis.success ? analysis.data.title : document.original_filename}
        </h1>
      </div>

      {document.status === "failed" && (
        <Card className="mb-6 border border-red-100 p-5">
          <p className="text-sm text-red-700" role="alert">
            {document.error_message ??
              "We couldn’t process this document. Please try again."}
          </p>
          <form action={retryLearningDocumentAction} className="mt-4">
            <input type="hidden" name="documentId" value={document.id} />
            <Button type="submit" variant="secondary">Retry processing</Button>
          </form>
        </Card>
      )}
      {isProcessing && (
        <Card className="mb-6 p-5">
          <p className="font-bold text-[#35216B]" role="status">
            Your document is processing. This page will refresh automatically.
          </p>
          <p className="mt-2 text-sm text-[#77758A]">
            Extraction: {document.extraction_status} · Analysis: {document.analysis_status}.
            You can retry if the status hasn’t changed for 10 minutes.
          </p>
          <form action={retryLearningDocumentAction} className="mt-4">
            <input type="hidden" name="documentId" value={document.id} />
            <Button type="submit" variant="secondary">Retry if stalled</Button>
          </form>
        </Card>
      )}

      {document.status === "ready" && analysis.success && (
        <div className="grid gap-5">
          {quizFeaturesEnabled && (
            <Card className="flex flex-wrap items-center justify-between gap-4 border-[#DDD8EF] p-5 sm:p-6">
              <div>
                <h2 className="font-bold text-[#35216B]">Ready to practice?</h2>
                <p className="mt-1 text-sm text-[#77758A]">
                  Generate a multiple-choice quiz from this document.
                </p>
              </div>
              <Link
                href={`/dashboard/quizzes/new?documentId=${document.id}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#35216B] px-4 text-sm font-semibold text-white hover:bg-[#7655D9]"
              >
                Generate Quiz
              </Link>
            </Card>
          )}
          <Card className="p-5 sm:p-7">
            <h2 className="text-xl font-black">Overview</h2>
            <p className="mt-3 text-sm font-bold text-[#7655D9]">
              {analysis.data.subject}
            </p>
            <p className="mt-4 text-sm leading-7 text-[#4E4B60]">
              {analysis.data.summary}
            </p>
          </Card>

          <Card className="p-5 sm:p-7">
            <h2 className="text-xl font-black">Main topics</h2>
            <div className="mt-4 space-y-5">
              {analysis.data.topics.map((topic, index) => (
                <div key={`${topic.name}-${index}`}>
                  <h3 className="font-bold text-[#35216B]">{topic.name}</h3>
                  {topic.subtopics.length > 0 && (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[#4E4B60]">
                      {topic.subtopics.map((subtopic) => (
                        <li key={subtopic}>{subtopic}</li>
                      ))}
                    </ul>
                  )}
                  <Citations references={topic.sourceRefs} sourceIndex={sourceIndex} />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 sm:p-7">
            <h2 className="text-xl font-black">Key concepts</h2>
            {analysis.data.keyConcepts.length ? (
              <div className="mt-4 space-y-4">
                {analysis.data.keyConcepts.map((concept, index) => (
                  <div key={`${concept.name}-${index}`}>
                    <h3 className="font-bold text-[#35216B]">{concept.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#4E4B60]">
                      {concept.explanation}
                    </p>
                    <Citations references={concept.sourceRefs} sourceIndex={sourceIndex} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#77758A]">No distinct key concepts were identified.</p>
            )}
          </Card>

          <Card className="p-5 sm:p-7">
            <h2 className="text-xl font-black">Definitions</h2>
            {analysis.data.definitions.length ? (
              <dl className="mt-4 space-y-4">
                {analysis.data.definitions.map((definition, index) => (
                  <div key={`${definition.term}-${index}`}>
                    <dt className="font-bold text-[#35216B]">{definition.term}</dt>
                    <dd className="mt-1 text-sm leading-6 text-[#4E4B60]">
                      {definition.definition}
                    </dd>
                    <Citations references={definition.sourceRefs} sourceIndex={sourceIndex} />
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-[#77758A]">No explicit definitions were found.</p>
            )}
          </Card>

          <Card className="p-5 sm:p-7">
            <h2 className="text-xl font-black">Important facts</h2>
            {analysis.data.importantFacts.length ? (
              <ul className="mt-4 space-y-4">
                {analysis.data.importantFacts.map((fact, index) => (
                  <li key={`${fact.fact}-${index}`}>
                    <p className="text-sm font-semibold leading-6 text-[#35216B]">
                      {fact.fact}
                    </p>
                    {fact.explanation && (
                      <p className="mt-1 text-sm leading-6 text-[#4E4B60]">
                        {fact.explanation}
                      </p>
                    )}
                    <Citations references={fact.sourceRefs} sourceIndex={sourceIndex} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[#77758A]">No distinct facts were identified.</p>
            )}
          </Card>

          <Card className="p-5 sm:p-7">
            <h2 className="text-xl font-black">Source sections</h2>
            <ol className="mt-4 space-y-2">
              {(sections ?? []).map((section) => (
                <li
                  key={section.source_id}
                  className="text-sm leading-6 text-[#4E4B60]"
                >
                  <span className="font-bold text-[#35216B]">
                    {section.page_or_location}
                  </span>
                  {" — "}
                  {section.title}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}

      {document.status === "ready" && !analysis.success && (
        <Card className="p-5">
          <p className="text-sm text-red-700" role="alert">
            The saved analysis is incomplete. Retry processing this document.
          </p>
          <form action={retryLearningDocumentAction} className="mt-4">
            <input type="hidden" name="documentId" value={document.id} />
            <Button type="submit" variant="secondary">Retry processing</Button>
          </form>
        </Card>
      )}
    </AppShell>
  );
}
