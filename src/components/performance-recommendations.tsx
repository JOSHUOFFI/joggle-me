"use client";

import { useState } from "react";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  persistedRecommendationsSchema,
  studyRecommendationsSchema,
  type RecommendationSource,
} from "@/lib/performance/recommendations";

const responseSchema = z.object({
  generationStatus: z.enum(["ready", "fallback"]),
  recommendations: studyRecommendationsSchema,
  generatedAt: z.iso.datetime({ offset: true }),
  message: z.string().optional(),
});

type PersistedRecommendations = z.infer<typeof persistedRecommendationsSchema>;

export function PerformanceRecommendations({
  attemptId,
  initial,
  sources,
}: {
  attemptId: string;
  initial: PersistedRecommendations | null;
  sources: RecommendationSource[];
}) {
  const [record, setRecord] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const sourceById = new Map(sources.map((source) => [source.sourceId, source]));

  const generate = async () => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/performance/${attemptId}/recommendations`,
        { method: "POST" },
      );
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The recommendation response could not be read.");
      }

      const parsed = responseSchema.safeParse(payload);
      if (!parsed.success || !response.ok) {
        throw new Error(
          parsed.success
            ? parsed.data.message ?? "Recommendations could not be created."
            : "The recommendation response was incomplete.",
        );
      }
      setRecord({
        generation_status: parsed.data.generationStatus,
        recommendations: parsed.data.recommendations,
        generated_at: parsed.data.generatedAt,
        updated_at: parsed.data.generatedAt,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Recommendations could not be created. Please retry.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-labelledby="study-recommendations-heading" className="mt-8">
      <div className="mb-4">
        <p className="text-sm font-bold text-[#7655D9]">Your next steps</p>
        <h2
          id="study-recommendations-heading"
          className="mt-1 text-2xl font-black text-[#35216B]"
        >
          Personalised study recommendations
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#77758A]">
          Suggestions are based on your submitted answers and this document.
          Topic progress is not classified until there are at least five answered questions.
        </p>
      </div>

      {!record ? (
        <Card className="p-5">
          <p className="text-sm leading-6 text-[#4E4B60]">
            Get practical revision steps based on the questions you answered correctly,
            missed, or left blank.
          </p>
          <Button className="mt-4" onClick={generate} disabled={pending}>
            {pending ? "Preparing recommendations…" : "Get study recommendations"}
          </Button>
        </Card>
      ) : (
        <Card className="p-5">
          <p className="mb-4 text-sm text-[#77758A]" role="status">
            {record.generation_status === "ready"
              ? "AI recommendations were checked against this result and its source references."
              : "These recommendations use your final answers because AI recommendations were unavailable."}
          </p>
          <ol className="grid gap-3">
            {record.recommendations.map((recommendation, index) => (
              <li
                key={`${recommendation.topic}-${index}`}
                className="rounded-xl border border-[#ECEAF5] bg-white p-4"
              >
                <h3 className="font-bold text-[#35216B]">{recommendation.title}</h3>
                <p className="mt-1 text-sm leading-6 text-[#4E4B60]">
                  {recommendation.action}
                </p>
                <p className="mt-2 text-xs font-semibold text-[#77758A]">
                  Topic: {recommendation.topic}
                </p>
                <p className="mt-1 text-xs text-[#77758A]">
                  Sources:{" "}
                  {recommendation.sourceRefs.map((sourceId) => {
                    const source = sourceById.get(sourceId);
                    return source
                      ? `${source.pageOrLocation} — ${source.title}`
                      : sourceId;
                  }).join("; ")}
                </p>
              </li>
            ))}
          </ol>
          {record.generation_status === "fallback" && (
            <Button className="mt-4" onClick={generate} disabled={pending} variant="secondary">
              {pending ? "Retrying…" : "Retry AI recommendations"}
            </Button>
          )}
        </Card>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
