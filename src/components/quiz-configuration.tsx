"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { QuizDifficulty } from "@/lib/quizzes/types";

const responseSchema = z.object({
  quizId: z.uuid().optional(),
  message: z.string().optional(),
});

const questionCountChoices = ["5", "10", "15", "20", "30"] as const;
const durationChoices = ["10", "15", "20", "30", "45", "60"] as const;

export function QuizConfiguration({
  documentId,
  documentTitle,
  topics,
}: {
  documentId: string;
  documentTitle: string;
  topics: string[];
}) {
  const router = useRouter();
  const [questionCount, setQuestionCount] = useState("10");
  const [customQuestionCount, setCustomQuestionCount] = useState("10");
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("mixed");
  const [duration, setDuration] = useState("20");
  const [customDuration, setCustomDuration] = useState("20");
  const [selectedTopics, setSelectedTopics] = useState(() => new Set(topics));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const toggleTopic = (topic: string) => {
    setSelectedTopics((current) => {
      const next = new Set(current);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const count = Number(
      questionCount === "custom" ? customQuestionCount : questionCount,
    );
    const durationMinutes = Number(
      duration === "custom" ? customDuration : duration,
    );
    if (!Number.isInteger(count) || count < 1 || count > 30) {
      setError("Enter a custom question count from 1 to 30.");
      return;
    }
    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 180
    ) {
      setError("Enter a custom duration from 1 to 180 minutes.");
      return;
    }
    if (!selectedTopics.size) {
      setError("Select at least one topic for your quiz.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/quizzes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          questionCount: count,
          difficulty,
          durationMinutes,
          selectedTopics: [...selectedTopics],
        }),
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The server returned an unreadable response. Please retry.");
      }
      const parsed = responseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("The server returned an invalid response. Please retry.");
      }
      if (!response.ok || !parsed.data.quizId) {
        throw new Error(parsed.data.message ?? "Quiz generation failed. Please retry.");
      }
      router.push(`/dashboard/quizzes/${parsed.data.quizId}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Quiz generation failed. Please retry.",
      );
      setPending(false);
    }
  };

  return (
    <Card className="p-5 sm:p-7">
      <form className="space-y-7" onSubmit={generate} aria-busy={pending}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="question-count" className="mb-2 block text-sm font-bold">
              Number of questions
            </label>
            <select
              id="question-count"
              value={questionCount}
              onChange={(event) => setQuestionCount(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#DDD8EF] bg-white px-3 text-sm"
              disabled={pending}
            >
              {questionCountChoices.map((choice) => (
                <option key={choice} value={choice}>{choice}</option>
              ))}
              <option value="custom">Custom</option>
            </select>
            {questionCount === "custom" && (
              <input
                aria-label="Custom question count"
                type="number"
                min={1}
                max={30}
                value={customQuestionCount}
                onChange={(event) => setCustomQuestionCount(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-[#DDD8EF] px-3 text-sm"
                disabled={pending}
              />
            )}
          </div>
          <div>
            <label htmlFor="difficulty" className="mb-2 block text-sm font-bold">
              Difficulty
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as QuizDifficulty)}
              className="h-11 w-full rounded-xl border border-[#DDD8EF] bg-white px-3 text-sm"
              disabled={pending}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div>
            <label htmlFor="duration" className="mb-2 block text-sm font-bold">
              Duration
            </label>
            <select
              id="duration"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#DDD8EF] bg-white px-3 text-sm"
              disabled={pending}
            >
              {durationChoices.map((choice) => (
                <option key={choice} value={choice}>{choice} minutes</option>
              ))}
              <option value="custom">Custom</option>
            </select>
            {duration === "custom" && (
              <input
                aria-label="Custom duration in minutes"
                type="number"
                min={1}
                max={180}
                value={customDuration}
                onChange={(event) => setCustomDuration(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-[#DDD8EF] px-3 text-sm"
                disabled={pending}
              />
            )}
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-bold">Question type</legend>
            <label className="flex h-11 items-center gap-2 text-sm">
              <input type="radio" checked readOnly aria-label="Multiple Choice (MCQ)" />
              Multiple Choice (MCQ)
            </label>
          </fieldset>
        </div>

        <fieldset>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <legend className="text-sm font-bold">Topics</legend>
            <button
              type="button"
              onClick={() => setSelectedTopics(new Set(topics))}
              className="text-sm font-semibold text-[#7655D9] hover:underline"
              disabled={pending}
            >
              Select all
            </button>
          </div>
          <div className="grid gap-2 rounded-xl border border-[#ECEAF5] p-4 sm:grid-cols-2">
            {topics.map((topic) => (
              <label key={topic} className="flex items-start gap-2 text-sm text-[#4E4B60]">
                <input
                  type="checkbox"
                  checked={selectedTopics.has(topic)}
                  onChange={() => toggleTopic(topic)}
                  disabled={pending}
                  className="mt-0.5 accent-[#7655D9]"
                />
                <span>{topic}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <p className="text-sm text-[#77758A]">
          Questions will be generated from <span className="font-semibold">{documentTitle}</span> only.
        </p>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <Button type="submit" disabled={pending || !topics.length}>
          {pending ? "Generating quiz…" : "Generate Quiz"}
        </Button>
      </form>
    </Card>
  );
}
