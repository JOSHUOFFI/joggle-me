"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { BookOpenCheck, CircleAlert, FileQuestion, LoaderCircle, Sparkles } from "lucide-react";
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
    <Card className="experience-card p-5 sm:p-8">
      <form className="space-y-7" onSubmit={generate} aria-busy={pending}>
        <div className="mb-1 flex flex-wrap items-start justify-between gap-4 border-b border-[#ECEAF5] pb-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="quiz-document-icon"><BookOpenCheck size={21} aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#77758A]">Building from</p>
              <h2 className="mt-1 break-words text-lg font-bold text-[#35216B]">{documentTitle}</h2>
            </div>
          </div>
          <span className="quiz-count-pill">{topics.length} available {topics.length === 1 ? "topic" : "topics"}</span>
        </div>

        <section aria-labelledby="quiz-format-heading">
          <div className="mb-4">
            <p className="experience-kicker">Quiz format</p>
            <h2 id="quiz-format-heading" className="mt-1 text-lg font-bold text-[#35216B]">Set your pace</h2>
            <p className="mt-1 text-sm leading-6 text-[#77758A]">Choose how many questions to practise and how challenging they should be.</p>
          </div>
          <div className="quiz-configuration-grid">
            <div>
              <label htmlFor="question-count" className="experience-field-label">Number of questions</label>
              <select
                id="question-count"
                value={questionCount}
                onChange={(event) => setQuestionCount(event.target.value)}
                className="experience-select"
                disabled={pending}
              >
                {questionCountChoices.map((choice) => (
                  <option key={choice} value={choice}>{choice} questions</option>
                ))}
                <option value="custom">Custom</option>
              </select>
              {questionCount === "custom" ? (
                <input
                  aria-label="Custom question count"
                  type="number"
                  min={1}
                  max={30}
                  value={customQuestionCount}
                  onChange={(event) => setCustomQuestionCount(event.target.value)}
                  className="experience-number-input mt-2"
                  disabled={pending}
                />
              ) : <span className="experience-field-help">Choose between 1 and 30 questions.</span>}
            </div>
            <div>
              <label htmlFor="difficulty" className="experience-field-label">Difficulty</label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as QuizDifficulty)}
                className="experience-select"
                disabled={pending}
              >
                <option value="easy">Easy · Build confidence</option>
                <option value="medium">Medium · Strengthen recall</option>
                <option value="hard">Hard · Stretch your understanding</option>
                <option value="mixed">Mixed · A balanced challenge</option>
              </select>
              <span className="experience-field-help">Mixed difficulty is the default.</span>
            </div>
            <div>
              <label htmlFor="duration" className="experience-field-label">Examination duration</label>
              <select
                id="duration"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                className="experience-select"
                disabled={pending}
              >
                {durationChoices.map((choice) => (
                  <option key={choice} value={choice}>{choice} minutes</option>
                ))}
                <option value="custom">Custom</option>
              </select>
              {duration === "custom" ? (
                <input
                  aria-label="Custom duration in minutes"
                  type="number"
                  min={1}
                  max={180}
                  value={customDuration}
                  onChange={(event) => setCustomDuration(event.target.value)}
                  className="experience-number-input mt-2"
                  disabled={pending}
                />
              ) : <span className="experience-field-help">The timer starts when you begin the examination.</span>}
            </div>
            <fieldset>
              <legend className="experience-field-label">Question type</legend>
              <div className="quiz-type-note">
                <FileQuestion size={19} className="text-[#7655D9]" aria-hidden="true" />
                Multiple choice (MCQ)
              </div>
              <span className="experience-field-help">Each question has four answer choices.</span>
            </fieldset>
          </div>
        </section>

        <fieldset>
          <legend className="text-base font-bold text-[#35216B]">Choose topics</legend>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mt-1 text-sm text-[#77758A]">Questions will focus on the topics you select.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#77758A]" aria-live="polite">
                {selectedTopics.size} of {topics.length} selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedTopics(new Set(topics))}
                className="inline-flex min-h-10 items-center justify-center rounded-lg px-2 text-sm font-bold text-[#7655D9] hover:bg-[#F0ECFB] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7655D9]/20 disabled:opacity-50"
                disabled={pending}
              >
                Select all
              </button>
            </div>
          </div>
          <div className="quiz-topic-list">
            {topics.map((topic) => {
              const isSelected = selectedTopics.has(topic);
              return (
                <label key={topic} className={`quiz-topic-option${isSelected ? " is-selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleTopic(topic)}
                    disabled={pending}
                  />
                  <span className="min-w-0 break-words">{topic}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="quiz-form-footer">
          <p className="flex min-w-0 items-start gap-2 text-sm leading-6 text-[#77758A]">
            <Sparkles size={17} className="mt-1 shrink-0 text-[#7655D9]" aria-hidden="true" />
            Questions are created from <span className="font-semibold text-[#35216B]">{documentTitle}</span> only.
          </p>
          {error && <p className="experience-inline-alert w-full" role="alert"><CircleAlert size={17} className="mr-2 inline" aria-hidden="true" />{error}</p>}
          {pending && (
            <p className="quiz-generation-status w-full" role="status" aria-live="polite">
              <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
              Generating your quiz. This may take a little while.
            </p>
          )}
          <Button type="submit" className="min-w-44" disabled={pending || !topics.length}>
            {pending ? <><LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> Generating…</> : <><Sparkles size={17} aria-hidden="true" /> Generate quiz</>}
          </Button>
        </div>
      </form>
    </Card>
  );
}
