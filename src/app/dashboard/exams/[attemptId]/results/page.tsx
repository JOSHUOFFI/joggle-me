import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { PerformanceRecommendations } from "@/components/performance-recommendations";
import { requireRole } from "@/lib/auth";
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
  const { supabase, user } = await requireRole(["learner"]);
  const { attemptId } = await params;
  const parsedAttemptId = z.uuid().safeParse(attemptId);
  if (!parsedAttemptId.success) notFound();

  const { data: attemptData, error: attemptError } = await supabase.rpc(
    "get_quiz_attempt_state",
    { p_attempt_id: parsedAttemptId.data },
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/dashboard/quizzes/${quiz.id}`}
          className="text-sm font-bold text-[#7655D9] hover:underline"
        >
          ← Back to quiz
        </Link>
        <Link
          href="/dashboard/performance"
          className="text-sm font-bold text-[#7655D9] hover:underline"
        >
          My Performance
        </Link>
      </div>
      <div className="mb-6 mt-5">
        <p className="text-sm font-bold text-[#7655D9]">Examination results</p>
        <h1 className="mt-1 break-words text-3xl font-black text-[#17152A]">
          {quiz.title}
        </h1>
        <p className="mt-2 text-sm text-[#77758A]">
          {subject} · Source document: {document?.original_filename ?? "Learning material"}
        </p>
      </div>

      <Card className="mb-6 p-5 sm:p-7">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-sm text-[#77758A]">Total score</p>
            <p className="mt-1 text-3xl font-black text-[#35216B]">
              {attempt.total_score ?? correctCount} / {attempt.question_count}
            </p>
          </div>
          <div>
            <p className="text-sm text-[#77758A]">Percentage</p>
            <p className="mt-1 text-3xl font-black text-[#35216B]">{percentage}%</p>
            <p className="mt-1 text-sm font-semibold text-[#35216B]">
              {getPerformanceClassification(percentage)}
            </p>
          </div>
          <div>
            <p className="text-sm text-[#77758A]">Total questions</p>
            <p className="mt-1 text-2xl font-black text-[#35216B]">{attempt.question_count}</p>
          </div>
          <div>
            <p className="text-sm text-[#77758A]">Date completed</p>
            <p className="mt-1 font-semibold text-[#35216B]">{completedDate}</p>
          </div>
          <div>
            <p className="text-sm text-[#77758A]">Time taken</p>
            <p className="mt-1 font-semibold text-[#35216B]">{timeTaken}</p>
          </div>
          <div>
            <p className="text-sm text-[#77758A]">Submission</p>
            <p className="mt-1 font-semibold capitalize text-[#35216B]">
              {attempt.submission_reason === "timeout"
                ? "Automatically submitted at the deadline"
                : "Submitted"}
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <span className="font-bold">{correctCount}</span> correct
          </p>
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">
            <span className="font-bold">{incorrectCount}</span> incorrect
          </p>
          <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-800">
            <span className="font-bold">{unansweredCount}</span> unanswered
          </p>
        </div>
        <p className="mt-5 rounded-xl bg-[#F7F7FC] p-4 text-sm leading-6 text-[#4E4B60]">
          {getPerformanceRemark(percentage)}
        </p>
      </Card>

      {rewardDataUnavailable ? (
        <Card className="mb-6 p-4 text-sm text-amber-900" role="status">
          Your examination result is saved. Reward details are temporarily unavailable;
          check Achievements on your dashboard later.
        </Card>
      ) : (xpEarned > 0 || unlockedBadgeTitles.length > 0) ? (
        <Card className="mb-6 border border-emerald-200 bg-emerald-50 p-4" role="status">
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
          <h2 id="result-topics-heading" className="text-2xl font-black text-[#35216B]">
            Topic performance
          </h2>
          <p className="mt-1 text-sm text-[#77758A]">
            Topic labels come from the quiz. A status needs at least five answered questions;
            fewer responses are shown as not enough data.
          </p>
        </div>
        {!reviewIsConsistent ? (
          <Card className="p-5 text-sm text-amber-900" role="status">
            Topic analysis is unavailable because the saved question review does not match
            the final score. Your stored examination result has not been changed.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {topicPerformance.map((topic) => (
              <Card key={topic.name} className="p-4">
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
        <h2 className="text-2xl font-black text-[#35216B]">Question review</h2>
        <p className="mt-1 text-sm text-[#77758A]">
          Review your selected answers, correct answers, explanations, and source sections.
        </p>
      </div>
      <div className="space-y-4">
        {!reviewIsConsistent ? (
          <Card className="p-5 text-sm text-amber-900" role="status">
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
            <Card key={`${question.index}-${question.question}`} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-bold leading-6 text-[#35216B]">
                  {question.index + 1}. {question.question}
                </h3>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isCorrect
                    ? "bg-emerald-50 text-emerald-800"
                    : selectedAnswer === null
                      ? "bg-slate-100 text-slate-700"
                      : "bg-red-50 text-red-800"
                }`}>
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
                      className={`rounded-xl border px-4 py-3 text-sm ${
                        option.label === question.correctAnswer
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                          : option.label === selectedAnswer
                            ? "border-red-300 bg-red-50 text-red-900"
                            : "border-[#ECEAF5] text-[#4E4B60]"
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
              <p className="mt-4 text-sm leading-6 text-[#4E4B60]">
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
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#DDD8EF] bg-white px-4 text-sm font-semibold text-[#35216B] hover:bg-[#F7F7FC]"
      >
        Take another attempt
      </Link>
    </AppShell>
  );
}
