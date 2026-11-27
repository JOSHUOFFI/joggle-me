"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  attemptAnswersSchema,
  quizAttemptStateSchema,
  type ExamQuestionView,
  type QuizAttemptState,
} from "@/lib/exams/types";

const responseSchema = z.object({
  state: quizAttemptStateSchema,
  message: z.string().optional(),
});

type SaveStatus = "saved" | "saving" | "offline" | "error";
const answerCacheEvent = "joggle-me:exam-answer-cache";

function subscribeAnswerCache(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(answerCacheEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(answerCacheEvent, callback);
  };
}

function getAnswerCacheSnapshot(key: string, questionCount: number) {
  const cachedAnswers = readAnswerCache(key, questionCount);
  return cachedAnswers ? JSON.stringify(cachedAnswers) : "";
}

function readAnswerCache(key: string, questionCount: number) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = attemptAnswersSchema.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.length === questionCount
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}

function displayTime(milliseconds: number) {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function Examination({
  initialState,
  questions,
  quizTitle,
  sourceFilename,
}: {
  initialState: QuizAttemptState;
  questions: ExamQuestionView[];
  quizTitle: string;
  sourceFilename: string;
}) {
  const router = useRouter();
  const storageKey = `joggle-me:exam-pending:${initialState.attempt_id}`;
  const [fallbackAnswers, setFallbackAnswers] = useState(initialState.answers);
  const subscribe = useCallback(
    (callback: () => void) => subscribeAnswerCache(callback),
    [],
  );
  const getSnapshot = useCallback(
    () => getAnswerCacheSnapshot(storageKey, questions.length),
    [questions.length, storageKey],
  );
  const cachedSnapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const cachedAnswers = useMemo(
    () => attemptAnswersSchema.safeParse(
      cachedSnapshot ? JSON.parse(cachedSnapshot) : null,
    ),
    [cachedSnapshot],
  );
  const answers = cachedAnswers.success ? cachedAnswers.data : fallbackAnswers;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const statusRef = useRef(initialState.status);
  const submittingRef = useRef(false);
  const autoSubmitStartedRef = useRef(false);
  const restoredCacheRef = useRef(false);
  const remainingRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retrySubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const submitAttempt = useCallback(async (
    finalAnswers?: QuizAttemptState["answers"],
  ): Promise<boolean> => {
    if (submittingRef.current || statusRef.current !== "in_progress") {
      return false;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/exams/${initialState.attempt_id}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            finalAnswers ? { answers: finalAnswers } : {},
          ),
        },
      );
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The submission response could not be read.");
      }

      const parsed = responseSchema.safeParse(payload);
      if (!parsed.success || !response.ok) {
        throw new Error(
          parsed.success
            ? parsed.data.message ?? "The examination could not be submitted."
            : "The examination result could not be confirmed.",
        );
      }

      if (parsed.data.state.status !== "submitted") {
        throw new Error("The server has not confirmed the examination submission.");
      }

      statusRef.current = "submitted";
      window.localStorage.removeItem(storageKey);
      router.replace(`/dashboard/exams/${initialState.attempt_id}/results`);
      return true;
    } catch (submitError) {
      setMessage(
        submitError instanceof Error
          ? submitError.message
          : "The examination could not be submitted. Please retry.",
      );
      return false;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [initialState.attempt_id, router, storageKey]);

  const sendAnswers = useCallback(async (
    answerSnapshot: QuizAttemptState["answers"],
  ) => {
    if (statusRef.current !== "in_progress") return;
    setSaveStatus("saving");
    try {
      const response = await fetch(
        `/api/exams/${initialState.attempt_id}/answers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: answerSnapshot }),
        },
      );
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The answer save response could not be read.");
      }

      const parsed = responseSchema.safeParse(payload);
      if (!parsed.success || !response.ok) {
        throw new Error(
          parsed.success
            ? parsed.data.message ?? "Your answers could not be saved."
            : "Your saved answers could not be confirmed.",
        );
      }

      if (parsed.data.state.status === "submitted") {
        statusRef.current = "submitted";
        window.localStorage.removeItem(storageKey);
        router.replace(`/dashboard/exams/${initialState.attempt_id}/results`);
        return;
      }

      const currentPending = readAnswerCache(storageKey, questions.length);
      if (currentPending && JSON.stringify(currentPending) === JSON.stringify(answerSnapshot)) {
        setSaveStatus("saved");
      } else if (!currentPending) {
        setSaveStatus("saved");
      }
    } catch {
      setSaveStatus(navigator.onLine ? "error" : "offline");
      setMessage(
        navigator.onLine
          ? "Your latest answer is kept on this device. We’ll retry saving it."
          : "You’re offline. Your latest answer is kept on this device and will sync when you reconnect.",
      );
    }
  }, [initialState.attempt_id, questions.length, router, storageKey]);

  const queueSave = useCallback((
    answerSnapshot: QuizAttemptState["answers"],
  ) => {
    saveQueueRef.current = saveQueueRef.current.then(
      () => sendAnswers(answerSnapshot),
    );
  }, [sendAnswers]);

  useEffect(() => {
    if (!restoredCacheRef.current) {
      restoredCacheRef.current = true;
      if (cachedAnswers.success) queueSave(cachedAnswers.data);
    }

    const syncPendingAnswers = () => {
      const pendingAnswers = readAnswerCache(storageKey, questions.length);
      if (pendingAnswers) queueSave(pendingAnswers);
      if (remainingRef.current !== null && remainingRef.current <= 0) {
        void submitAttempt();
      }
    };
    window.addEventListener("online", syncPendingAnswers);
    return () => window.removeEventListener("online", syncPendingAnswers);
  }, [cachedAnswers, queueSave, questions.length, storageKey, submitAttempt]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    const durationMs = Math.max(
      0,
      Date.parse(initialState.deadline_at) - Date.parse(initialState.server_now),
    );
    const startedAt = performance.now();

    const updateRemaining = () => {
      const remaining = Math.max(0, durationMs - (performance.now() - startedAt));
      remainingRef.current = remaining;
      setRemainingMs(remaining);
      if (remaining === 0 && !autoSubmitStartedRef.current) {
        autoSubmitStartedRef.current = true;
        const retry = async () => {
          const submitted = await submitAttempt();
          if (!submitted && statusRef.current === "in_progress") {
            retrySubmitRef.current = setTimeout(() => {
              void retry();
            }, 2500);
          }
        };
        void retry();
      }
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 250);
    return () => {
      clearInterval(timer);
      if (retrySubmitRef.current) clearTimeout(retrySubmitRef.current);
    };
  }, [initialState.deadline_at, initialState.server_now, submitAttempt]);

  const chooseAnswer = (label: "A" | "B" | "C" | "D") => {
    if (statusRef.current !== "in_progress" || submittingRef.current) return;
    const nextAnswers = [...answers];
    nextAnswers[currentIndex] = label;
    setFallbackAnswers(nextAnswers);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextAnswers));
      window.dispatchEvent(new Event(answerCacheEvent));
    } catch {
      setSaveStatus("error");
      setMessage("Browser storage is unavailable. Answers will still be sent to the server.");
    }
    setSaveStatus("saving");
    setMessage("");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => queueSave(nextAnswers), 300);
  };

  const confirmSubmission = async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setConfirming(false);
    await submitAttempt(answers);
  };

  const currentQuestion = questions[currentIndex];
  const answeredCount = answers.filter((answer) => answer !== null).length;
  const unansweredCount = questions.length - answeredCount;
  const remainingLabel =
    remainingMs === null ? "--:--" : displayTime(remainingMs);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#7655D9]">Examination in progress</p>
          <h1 className="mt-1 break-words text-2xl font-black text-[#17152A] sm:text-3xl">
            {quizTitle}
          </h1>
          <p className="mt-1 text-sm text-[#77758A]">Source: {sourceFilename}</p>
        </div>
        <div
          className="rounded-xl border border-[#DDD8EF] bg-white px-4 py-3 text-center"
          aria-live="polite"
          aria-label={`Time remaining ${remainingLabel}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[#77758A]">
            Time remaining
          </p>
          <p className={`mt-1 font-mono text-2xl font-black ${remainingMs !== null && remainingMs < 60_000 ? "text-red-700" : "text-[#35216B]"}`}>
            {remainingLabel}
          </p>
        </div>
      </div>

      <Card className="mb-5 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="font-semibold text-[#35216B]">
            {answeredCount} of {questions.length} answered
          </p>
          <p className="text-[#77758A]" aria-live="polite">
            {saveStatus === "saved" && "All answers saved"}
            {saveStatus === "saving" && "Saving answers…"}
            {saveStatus === "offline" && "Saved on this device"}
            {saveStatus === "error" && "Save will retry"}
          </p>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-[#ECEAF5]"
          role="progressbar"
          aria-label="Examination progress"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={answeredCount}
        >
          <div
            className="h-full rounded-full bg-[#7655D9] transition-[width]"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <Card className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-[#7655D9]">
              Question {currentIndex + 1} of {questions.length}
            </p>
            <span className="rounded-full bg-[#F0ECFB] px-3 py-1 text-xs font-semibold capitalize text-[#35216B]">
              {currentQuestion.difficulty}
            </span>
          </div>
          <h2 className="mt-4 text-lg font-bold leading-7 text-[#35216B] sm:text-xl">
            {currentQuestion.question}
          </h2>
          <p className="mt-2 text-sm text-[#77758A]">Topic: {currentQuestion.topic}</p>

          <fieldset className="mt-6 grid gap-3">
            <legend className="sr-only">Choose one answer</legend>
            {currentQuestion.options
              .slice()
              .sort((first, second) => first.label.localeCompare(second.label))
              .map((option) => {
                const selected = answers[currentIndex] === option.label;
                return (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseAnswer(option.label)}
                    disabled={submitting || remainingMs === 0}
                    className={`flex min-h-14 items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7655D9]/20 ${
                      selected
                        ? "border-[#7655D9] bg-[#F0ECFB] text-[#35216B]"
                        : "border-[#ECEAF5] bg-white text-[#4E4B60] hover:border-[#BFB4E5]"
                    }`}
                  >
                    <span className="mt-0.5 font-bold text-[#7655D9]">
                      {option.label}.
                    </span>
                    <span>{option.text}</span>
                  </button>
                );
              })}
          </fieldset>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
              disabled={currentIndex === 0 || submitting || remainingMs === 0}
            >
              Previous
            </Button>
            {currentIndex < questions.length - 1 ? (
              <Button
                type="button"
                onClick={() =>
                  setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))
                }
                disabled={submitting || remainingMs === 0}
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={submitting || remainingMs === 0}
              >
                Submit examination
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="font-bold text-[#35216B]">Question navigator</h2>
          <p className="mt-1 text-xs text-[#77758A]">
            Filled numbers are answered; outlined numbers are unanswered.
          </p>
          <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-4">
            {questions.map((question, index) => {
              const isAnswered = answers[index] !== null;
              const isCurrent = currentIndex === index;
              return (
                <button
                  key={`${index}-${question.question}`}
                  type="button"
                  aria-label={`Question ${index + 1}, ${isAnswered ? "answered" : "unanswered"}${isCurrent ? ", current" : ""}`}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => setCurrentIndex(index)}
                  disabled={submitting || remainingMs === 0}
                  className={`min-h-11 rounded-lg border text-sm font-bold ${
                    isCurrent
                      ? "border-[#35216B] bg-[#35216B] text-white"
                      : isAnswered
                        ? "border-[#7655D9] bg-[#F0ECFB] text-[#35216B]"
                        : "border-[#DDD8EF] bg-white text-[#77758A]"
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-5 grid gap-2 text-sm">
            <p><span className="font-bold text-[#35216B]">{answeredCount}</span> answered</p>
            <p><span className="font-bold text-[#77758A]">{unansweredCount}</span> unanswered</p>
          </div>
          <Button
            type="button"
            className="mt-5 w-full"
            onClick={() => setConfirming(true)}
            disabled={submitting || remainingMs === 0}
          >
            Submit examination
          </Button>
        </Card>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          {message}
        </p>
      )}

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17152A]/60 p-4"
          role="presentation"
        >
          <Card
            className="w-full max-w-md p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-confirmation-heading"
          >
            <h2 id="submit-confirmation-heading" className="text-xl font-black text-[#35216B]">
              Submit examination?
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#4E4B60]">
              You have answered {answeredCount} of {questions.length} questions.
              {" "}{unansweredCount} will be submitted unanswered. You cannot change answers after submission.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirming(false)}
                disabled={submitting}
              >
                Keep working
              </Button>
              <Button
                type="button"
                onClick={() => void confirmSubmission()}
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Confirm submission"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
