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
import { CircleAlert, CircleCheck, Clock, LoaderCircle, WifiOff } from "lucide-react";
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
    <div className="experience-page exam-experience">
      <header className="exam-header">
        <div>
          <p className="experience-kicker">Examination in progress</p>
          <h1 className="exam-title">
            {quizTitle}
          </h1>
          <p className="exam-source">Source: {sourceFilename}</p>
        </div>
        <div
          className={`exam-timer-card${remainingMs !== null && remainingMs < 60_000 ? " is-urgent" : ""}`}
          role="timer"
          aria-label={`Time remaining ${remainingLabel}`}
        >
          <p className="exam-timer-label flex items-center gap-2">
            <Clock size={15} aria-hidden="true" />
            Time remaining
          </p>
          <p className="exam-timer-value">
            {remainingLabel}
          </p>
        </div>
      </header>

      <Card className="experience-card exam-progress-card p-4 sm:p-5">
        <div className="exam-progress-copy">
          <p className="font-semibold">
            {answeredCount} of {questions.length} answered
          </p>
          <p className="exam-save-state" aria-live="polite">
            {saveStatus === "saved" && <><CircleCheck size={16} aria-hidden="true" /> All answers saved</>}
            {saveStatus === "saving" && <><LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> Saving answers…</>}
            {saveStatus === "offline" && <><WifiOff size={16} aria-hidden="true" /> Saved on this device</>}
            {saveStatus === "error" && <><CircleAlert size={16} aria-hidden="true" /> Save will retry</>}
          </p>
        </div>
        <div
          className="exam-progress-track mt-3"
          role="progressbar"
          aria-label="Examination progress"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={answeredCount}
          aria-valuetext={`${answeredCount} of ${questions.length} answered`}
        >
          <div
            className="exam-progress-fill"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
      </Card>

      <div className="exam-question-layout">
        <Card className="experience-card exam-question-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="experience-kicker">
              Question {currentIndex + 1} of {questions.length}
            </p>
            <span className="quiz-count-pill capitalize">
              {currentQuestion.difficulty}
            </span>
          </div>
          <h2 className="exam-question-heading">
            {currentQuestion.question}
          </h2>
          <p className="exam-topic-label">Topic: {currentQuestion.topic}</p>

          <fieldset className="exam-option-list">
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
                    className={`exam-option${selected ? " is-selected" : ""}`}
                  >
                    <span className="exam-option-label">{option.label}</span>
                    <span className="min-w-0">{option.text}</span>
                  </button>
                );
              })}
          </fieldset>

          <div className="exam-question-actions">
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

        <Card className="experience-card exam-navigator-card p-4 sm:p-5">
          <nav aria-label="Question navigator">
          <h2 className="exam-nav-title">Question navigator</h2>
          <p className="exam-nav-description">
            Filled numbers are answered; outlined numbers are unanswered.
          </p>
          <div className="exam-number-grid">
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
                  className={`exam-question-number${isCurrent ? " is-current" : isAnswered ? " is-answered" : ""}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <div className="exam-navigator-stats">
            <p><strong>{answeredCount}</strong> answered</p>
            <p><strong>{unansweredCount}</strong> unanswered</p>
          </div>
          <Button
            type="button"
            className="exam-navigator-submit"
            onClick={() => setConfirming(true)}
            disabled={submitting || remainingMs === 0}
          >
            Submit examination
          </Button>
          </nav>
        </Card>
      </div>

      {message && (
        <p className="exam-status-alert" role="status">
          {message}
        </p>
      )}

      {confirming && (
        <div
          className="exam-dialog-backdrop"
          role="presentation"
        >
          <Card
            className="experience-card exam-dialog p-6"
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
