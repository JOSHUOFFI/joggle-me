import Link from "next/link";
import { CalendarDays, Check, Clock, Minus, Sparkles, Trophy, X } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { PerformanceRecommendations } from "@/components/performance-recommendations";
import { requireGuestWorkspace } from "@/lib/guest-workspace";
import { getPerformanceRemark } from "@/lib/exams/results";
import { parseAttemptRpcResult } from "@/lib/exams/types";
import { logger } from "@/lib/logger";
import {
  buildQuestionReviews,
  buildTopicPerformance,
  formatTimeTaken,
  getPerformanceClassification,
  getTimeTakenMilliseconds,
} from "@/lib/performance/analytics";
import {
  getOwnedQuizQuestions,
  PerformanceDataError,
} from "@/lib/performance/data";
import { BADGE_DEFINITIONS } from "@/lib/gamification/metrics";
import {
  persistedRecommendationsSchema,
  type RecommendationSource,
} from "@/lib/performance/recommendations";
import { documentAnalysisSchema } from "@/lib/materials/types";

type SourceSection = {
  source_id: string;
  title: string;
  page_or_location: string;
};

const xpRewardRowsSchema = z.array(z.object({
  amount: z.number().int().positive(),
}));
const badgeRewardRowsSchema = z.array(z.object({
  badge_key: z.enum([
    "first_steps",
    "quiz_champion",
    "consistent_learner",
    "perfect_score",
    "dedicated_learner",
    "knowledge_seeker",
  ]),
}));

export default async function ExaminationResultsPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { supabase, user } = await requireGuestWorkspace();
  const { attemptId } = await params;
  const parsedAttemptId = z.uuid().safeParse(attemptId);
  if (!parsedAttemptId.success) notFound();

  const { data: attemptData, error: attemptError } = await supabase.rpc(
    "guest_get_quiz_attempt_state",
    {
      p_token_hash: user.guestTokenHash,
      p_attempt_id: parsedAttemptId.data,
    },
  );
  const attempt = parseAttemptRpcResult(attemptData);
  if (attemptError || !attempt) {
    if (attemptError && attemptError.code !== "42501") {
      logger.error("Examination result could not be loaded", {
        code: attemptError.code ?? null,
      });
    }
    notFound();
  }
  if (attempt.status !== "submitted") {
    redirect(`/dashboard/exams/${attempt.attempt_id}`);
  }

  const { data: quiz, error: quizError } = await supabase
    .from("learning_quizzes")
    .select("id,title,source_document_id,question_count")
    .eq("id", attempt.quiz_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (quizError || !quiz) notFound();

  let questions;
  try {
    questions = await getOwnedQuizQuestions(
      user.id,
      quiz.id,
      attempt.question_count,
    );
  } catch (error) {
    if (!(error instanceof PerformanceDataError)) throw error;
    logger.error("Examination answer review could not be loaded", {
      attemptId: attempt.attempt_id,
    });
    notFound();
  }

  const { data: document, error: documentError } = await supabase
    .from("learning_documents")
    .select("original_filename,analysis")
    .eq("id", quiz.source_document_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (documentError || !document) {
    logger.error("Examination source document could not be loaded", {
      code: documentError?.code ?? null,
    });
  }
  const analysis = documentAnalysisSchema.safeParse(document?.analysis);
  const subject = analysis.success ? analysis.data.subject : "Subject unavailable";

  const sourceIds = [...new Set(questions.flatMap((question) => question.sourceRefs))];
  const { data: sourceRows, error: sourceError } = sourceIds.length
    ? await supabase
        .from("document_sections")
        .select("source_id,title,page_or_location")
        .eq("document_id", quiz.source_document_id)
        .eq("user_id", user.id)
        .in("source_id", sourceIds)
    : { data: [], error: null };
  if (sourceError) {
    logger.error("Examination source references could not be loaded", {
      code: sourceError.code ?? null,
    });
  }
  const sourceIndex = new Map<string, SourceSection>(
    (sourceRows ?? []).map((source) => [source.source_id, source]),
  );

  const correctCount = attempt.correct_count ?? 0;
  const incorrectCount = attempt.incorrect_count ?? 0;
  const unansweredCount = attempt.unanswered_count ?? 0;
  const percentage = attempt.percentage ?? 0;
  const questionReviews = buildQuestionReviews(questions, attempt.answers);
  const reviewCounts = {
    correct: questionReviews.filter((question) => question.outcome === "correct").length,
    incorrect: questionReviews.filter((question) => question.outcome === "incorrect").length,
    unanswered: questionReviews.filter((question) => question.outcome === "unanswered").length,
  };
  const reviewIsConsistent =
    reviewCounts.correct === correctCount &&
    reviewCounts.incorrect === incorrectCount &&
    reviewCounts.unanswered === unansweredCount;
  if (!reviewIsConsistent) {
    logger.error("Question review does not match the finalized examination result", {
      attemptId: attempt.attempt_id,
    });
  }

  const topicPerformance = reviewIsConsistent
    ? buildTopicPerformance([{
        attemptId: attempt.attempt_id,
        subject,
        questions,
        answers: attempt.answers,
      }])
    : [];
  const submittedAt = attempt.submitted_at;
  if (!submittedAt) notFound();
  const completedDate = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(submittedAt));
  const timeTaken = formatTimeTaken(
    getTimeTakenMilliseconds(
      attempt.started_at,
      submittedAt,
      attempt.deadline_at,
    ),
  );
  const { data: recommendationData, error: recommendationError } = await supabase
    .from("exam_performance_recommendations")
    .select("generation_status,recommendations,generated_at,updated_at")
    .eq("attempt_id", attempt.attempt_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (recommendationError) {
    logger.warn("Saved examination recommendations could not be loaded", {
      code: recommendationError.code ?? null,
    });
  }
  const parsedRecommendations = persistedRecommendationsSchema.safeParse(
    recommendationData,
  );
  const savedRecommendations = parsedRecommendations.success
    ? parsedRecommendations.data
    : null;
  if (recommendationData && !parsedRecommendations.success) {
    logger.error("Saved examination recommendations failed validation", {
      attemptId: attempt.attempt_id,
    });
  }
  const recommendationSources: RecommendationSource[] = (sourceRows ?? []).map(
    (source) => ({
      sourceId: source.source_id,
      title: source.title,
      pageOrLocation: source.page_or_location,
    }),
  );
  const [xpRewardResult, badgeRewardResult] = await Promise.all([
    supabase
      .from("learner_xp_transactions")
      .select("amount")
      .eq("user_id", user.id)
      .eq("reference_attempt_id", attempt.attempt_id),
    supabase
      .from("learner_badges")
      .select("badge_key")
      .eq("user_id", user.id)
      .eq("reference_attempt_id", attempt.attempt_id),
  ]);
  const parsedXpRewards = xpRewardRowsSchema.safeParse(xpRewardResult.data);
  const parsedBadgeRewards = badgeRewardRowsSchema.safeParse(badgeRewardResult.data);
  const rewardDataUnavailable =
    Boolean(xpRewardResult.error || badgeRewardResult.error) ||
    !parsedXpRewards.success ||
    !parsedBadgeRewards.success;
  if (rewardDataUnavailable) {
    logger.warn("Examination gamification rewards could not be loaded", {
      attemptId: attempt.attempt_id,
      xpErrorCode: xpRewardResult.error?.code ?? null,
      badgeErrorCode: badgeRewardResult.error?.code ?? null,
    });
  }
  const xpEarned = parsedXpRewards.success
    ? parsedXpRewards.data.reduce((total, reward) => total + reward.amount, 0)
    : 0;
  const unlockedBadgeTitles = parsedBadgeRewards.success
    ? parsedBadgeRewards.data.map((reward) =>
        BADGE_DEFINITIONS.find((badge) => badge.key === reward.badge_key)?.title ??
        "Achievement",
      )
    : [];

  return (
    <AppShell>
      <section className="experience-page results-experience">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/dashboard/quizzes/${quiz.id}`}
          className="experience-back-link"
        >
          ← Back to quiz
        </Link>
        <Link
          href="/dashboard/performance"
          className="experience-back-link"
        >
          My Performance
        </Link>
      </div>
      <header className="results-header">
        <div>
        <p className="experience-kicker">Examination results</p>
        <h1 className="experience-title">
          {quiz.title}
        </h1>
        <p className="experience-description">
          {subject} · Source document: {document?.original_filename ?? "Learning material"}
        </p>
        </div>
        <span className="results-classification"><Sparkles size={15} aria-hidden="true" /> Saved result</span>
      </header>

      <Card className="experience-card results-scorecard mb-6 p-5 sm:p-7">
        <div className="results-score-overview">
          <div
            className="results-score-ring"
            role="img"
            aria-label={`Overall score: ${percentage} percent`}
            style={{ background: `conic-gradient(var(--learner-accent) ${percentage}%, var(--learner-border) 0)` }}
          >
            <div className="results-score-ring-inner">
              <span className="results-score-number">{percentage}%</span>
              <span className="results-score-caption">Overall</span>
            </div>
          </div>
          <div className="results-score-summary">
            <span className="results-classification"><Trophy size={15} aria-hidden="true" /> {getPerformanceClassification(percentage)}</span>
            <p className="results-remark">{getPerformanceRemark(percentage)}</p>
            <p className="results-total">
              Total score: {attempt.total_score ?? correctCount} of {attempt.question_count} questions
            </p>
          </div>
        </div>

        <div className="results-breakdown">
          <div
            className="results-breakdown-bar"
            role="img"
            aria-label={`Answer breakdown: ${correctCount} correct, ${incorrectCount} incorrect, ${unansweredCount} unanswered`}
          >
            <span className="results-breakdown-segment correct" style={{ width: `${(correctCount / attempt.question_count) * 100}%` }} />
            <span className="results-breakdown-segment incorrect" style={{ width: `${(incorrectCount / attempt.question_count) * 100}%` }} />
            <span className="results-breakdown-segment unanswered" style={{ width: `${(unansweredCount / attempt.question_count) * 100}%` }} />
          </div>
          <div className="results-stat-grid" role="group" aria-label="Answer statistics">
            <div className="results-stat correct">
              <span className="results-stat-icon"><Check size={19} aria-hidden="true" /></span>
              <span><span className="results-stat-value block">{correctCount}</span><span className="results-stat-label block">Correct</span></span>
            </div>
            <div className="results-stat incorrect">
              <span className="results-stat-icon"><X size={19} aria-hidden="true" /></span>
              <span><span className="results-stat-value block">{incorrectCount}</span><span className="results-stat-label block">Incorrect</span></span>
            </div>
            <div className="results-stat unanswered">
              <span className="results-stat-icon"><Minus size={19} aria-hidden="true" /></span>
              <span><span className="results-stat-value block">{unansweredCount}</span><span className="results-stat-label block">Unanswered</span></span>
            </div>
          </div>
        </div>

        <dl className="results-meta-grid">
          <div><dt className="results-meta-label">Questions</dt><dd className="results-meta-value">{attempt.question_count}</dd></div>
          <div><dt className="results-meta-label">Completed</dt><dd className="results-meta-value flex items-start gap-2"><CalendarDays className="mt-0.5 shrink-0" size={16} aria-hidden="true" />{completedDate}</dd></div>
          <div><dt className="results-meta-label">Time taken</dt><dd className="results-meta-value flex items-center gap-2"><Clock size={16} aria-hidden="true" />{timeTaken}</dd></div>
          <div><dt className="results-meta-label">Submission</dt><dd className="results-meta-value">{attempt.submission_reason === "timeout" ? "Automatically submitted" : "Submitted"}</dd></div>
        </dl>
      </Card>

      {rewardDataUnavailable ? (
      <Card className="experience-card mb-6 p-4 text-sm text-amber-900" role="status">
          Your examination result is saved. Reward details are temporarily unavailable;
          check Achievements on your dashboard later.
        </Card>
      ) : (xpEarned > 0 || unlockedBadgeTitles.length > 0) ? (
        <Card className="experience-card mb-6 border border-emerald-200 bg-emerald-50 p-4" role="status">
          <p className="font-bold text-emerald-900">
            {xpEarned > 0
              ? `You earned ${xpEarned} XP from this examination.`
              : "You unlocked an achievement!"}
          </p>
          {unlockedBadgeTitles.length > 0 && (
            <p className="mt-1 text-sm text-emerald-800">
              New badge{unlockedBadgeTitles.length === 1 ? "" : "s"}:{" "}
              {unlockedBadgeTitles.join(", ")}.
            </p>
          )}
        </Card>
      ) : null}

      <section aria-labelledby="result-topics-heading" className="mb-8">
        <div className="mb-4">
          <h2 id="result-topics-heading" className="results-section-heading">
            Topic performance
          </h2>
          <p className="mt-1 text-sm text-[#77758A]">
            Topic labels come from the quiz. A status needs at least five answered questions;
            fewer responses are shown as not enough data.
          </p>
        </div>
        {!reviewIsConsistent ? (
          <Card className="experience-card p-5 text-sm text-amber-900" role="status">
            Topic analysis is unavailable because the saved question review does not match
            the final score. Your stored examination result has not been changed.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {topicPerformance.map((topic) => (
              <Card key={topic.name} className="experience-card results-topic-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-bold text-[#35216B]">{topic.name}</h3>
                  <span className="rounded-full bg-[#F0ECFB] px-3 py-1 text-xs font-semibold text-[#35216B]">
                    {topic.classification === "strong"
                      ? "Strong"
                      : topic.classification === "needs_review"
                        ? "Needs review"
                        : topic.classification === "developing"
                          ? "Developing"
                          : "Not enough data"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#77758A]">
                  {topic.accuracy === null ? "No answered questions" : `${topic.accuracy}% of answered questions correct`}
                  {" · "}{topic.answeredCount} answered · {topic.unansweredCount} unanswered
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {reviewIsConsistent && (
        <PerformanceRecommendations
          attemptId={attempt.attempt_id}
          initial={savedRecommendations}
          sources={recommendationSources}
        />
      )}

      <div className="mb-4">
        <h2 className="results-section-heading">Question review</h2>
        <p className="mt-1 text-sm text-[#77758A]">
          Review your selected answers, correct answers, explanations, and source sections.
        </p>
      </div>
      <div className="space-y-4">
        {!reviewIsConsistent ? (
          <Card className="experience-card p-5 text-sm text-amber-900" role="status">
            Question-by-question review is unavailable because it does not match the final
            score. The stored result remains unchanged.
          </Card>
        ) : questionReviews.map((question) => {
          const selectedAnswer = question.selectedAnswer;
          const correctOption = question.options.find(
            (option) => option.label === question.correctAnswer,
          );
          const selectedOption = question.options.find(
            (option) => option.label === selectedAnswer,
          );
          const isCorrect = question.outcome === "correct";

          return (
            <Card key={`${question.index}-${question.question}`} className="experience-card results-review-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-bold leading-6 text-[#35216B]">
                  {question.index + 1}. {question.question}
                </h3>
                <span className={`results-outcome-badge ${
                  isCorrect
                    ? "correct"
                    : selectedAnswer === null
                      ? "unanswered"
                      : "incorrect"
                }`}>
                  {isCorrect ? <Check size={14} aria-hidden="true" /> : selectedAnswer === null ? <Minus size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                  {isCorrect ? "Correct" : selectedAnswer === null ? "Unanswered" : "Incorrect"}
                </span>
              </div>
              <p className="mt-2 text-xs text-[#77758A]">
                Topic: {question.topic} · {question.difficulty}
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {question.options
                  .slice()
                  .sort((first, second) => first.label.localeCompare(second.label))
                  .map((option) => (
                    <li
                      key={option.label}
                      className={`results-option${
                        option.label === question.correctAnswer
                          ? " correct"
                          : option.label === selectedAnswer
                            ? " incorrect"
                            : ""
                      }`}
                    >
                      <span className="mr-2 font-bold">{option.label}.</span>
                      {option.text}
                      {option.label === question.correctAnswer && (
                        <span className="ml-2 font-semibold">Correct answer</span>
                      )}
                      {option.label === selectedAnswer && (
                        <span className="ml-2 font-semibold">Your answer</span>
                      )}
                    </li>
                  ))}
              </ul>
              <p className={`mt-4 text-sm font-semibold ${
                isCorrect
              ? "text-emerald-800"
              : selectedAnswer === null
                ? "text-slate-700"
                : "text-red-800"
              }`}>
                {isCorrect
              ? "Your selected answer is correct."
              : selectedAnswer === null
                ? `No answer was selected. The correct answer is ${correctOption?.label ?? "unavailable"}.`
                : `Your selected answer ${selectedOption?.label ?? selectedAnswer} is incorrect. The correct answer is ${correctOption?.label ?? "unavailable"}.`}
              </p>
              <p className="results-feedback">
                <span className="font-bold text-[#35216B]">Explanation:</span>{" "}
                {question.explanation}
              </p>
              <p className="mt-3 text-xs text-[#77758A]">
                Sources:{" "}
                {question.sourceRefs.map((sourceId) => {
                  const source = sourceIndex.get(sourceId);
                  return source
                    ? `${source.page_or_location} — ${source.title}`
                    : sourceId;
                }).join("; ")}
              </p>
              <p className="mt-2 text-xs text-[#77758A]">
                Your answer: {selectedOption ? `${selectedOption.label}. ${selectedOption.text}` : "No answer"}.
                {" "}Correct answer: {correctOption ? `${correctOption.label}. ${correctOption.text}` : "Unavailable"}.
              </p>
            </Card>
          );
        })}
      </div>
      <Link
        href={`/dashboard/quizzes/${quiz.id}/exam`}
        className="results-take-another mt-6"
      >
        Take another attempt
      </Link>
      </section>
    </AppShell>
  );
}
