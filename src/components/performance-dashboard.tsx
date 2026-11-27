import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { GroupPerformance } from "@/lib/performance/analytics";
import type { PerformanceFilters } from "@/lib/performance/filters";

export type PerformanceHistoryEntry = {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  sourceDocumentId: string;
  sourceFilename: string;
  subject: string;
  submittedAt: string;
  submittedLabel: string;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  timeTaken: string;
  previousScore: number | null;
};

export type PerformanceFilterOption = {
  value: string;
  label: string;
};

type Summary = {
  completedCount: number;
  averageScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  totalAnsweredQuestions: number;
  correctAnswerPercentage: number | null;
  trendChange: number | null;
  trendDirection: "improving" | "declining" | "steady" | "insufficient_data";
};

function percentageLabel(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function classificationLabel(classification: GroupPerformance["classification"]) {
  if (classification === "strong") return "Strong";
  if (classification === "needs_review") return "Needs review";
  if (classification === "developing") return "Developing";
  return "Not enough data";
}

function classificationColor(classification: GroupPerformance["classification"]) {
  if (classification === "strong") return "bg-emerald-500";
  if (classification === "needs_review") return "bg-red-500";
  if (classification === "developing") return "bg-amber-500";
  return "bg-slate-300";
}

export function PerformanceDashboard({
  summary,
  attempts,
  topics,
  subjects,
  trend,
  filterOptions,
  filters,
  currentPage,
  pageCount,
  previousPageHref,
  nextPageHref,
  topicAnalysisAvailable,
}: {
  summary: Summary;
  attempts: PerformanceHistoryEntry[];
  topics: GroupPerformance[];
  subjects: GroupPerformance[];
  trend: { attemptId: string; quizTitle: string; submittedLabel: string; percentage: number }[];
  filterOptions: {
    subjects: PerformanceFilterOption[];
    sources: PerformanceFilterOption[];
  };
  filters: PerformanceFilters;
  currentPage: number;
  pageCount: number;
  previousPageHref: string | null;
  nextPageHref: string | null;
  topicAnalysisAvailable: boolean;
}) {
  const strongestSubjects = subjects
    .filter((subject) => subject.classification === "strong")
    .slice(0, 3);
  const subjectsToReview = subjects
    .filter((subject) => subject.classification === "needs_review")
    .slice(0, 3);
  const developingSubjects = subjects
    .filter((subject) => subject.classification === "developing")
    .slice(0, 3);

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-bold text-[#7655D9]">Your progress</p>
        <h1 className="mt-1 text-3xl font-black text-[#17152A]">My Performance</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#77758A]">
          See how you are doing, what is going well, and what to revisit.
          Only submitted examinations are included.
        </p>
      </div>

      <section aria-label="Overall performance summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Exams completed", String(summary.completedCount)],
          ["Average score", percentageLabel(summary.averageScore)],
          ["Highest score", percentageLabel(summary.highestScore)],
          ["Lowest score", percentageLabel(summary.lowestScore)],
        ].map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="text-sm text-[#77758A]">{label}</p>
            <p className="mt-2 text-2xl font-black text-[#35216B]">{value}</p>
          </Card>
        ))}
      </section>

      {!summary.completedCount ? (
        <Card className="mt-6 p-6">
          <h2 className="text-xl font-bold text-[#35216B]">Your progress starts with an exam</h2>
          <p className="mt-2 text-sm leading-6 text-[#77758A]">
            Once you submit your first quiz, your scores, topic progress, and study
            recommendations will appear here.
          </p>
          <Link
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#35216B] px-4 text-sm font-semibold text-white hover:bg-[#7655D9]"
            href="/dashboard/quizzes"
          >
            View My Quizzes
          </Link>
        </Card>
      ) : (
        <>
          <section aria-label="Answer and improvement summary" className="mt-4 grid gap-3 md:grid-cols-2">
            <Card className="p-5">
              <p className="text-sm text-[#77758A]">Questions answered</p>
              <p className="mt-2 text-2xl font-black text-[#35216B]">
                {summary.totalAnsweredQuestions}
              </p>
              <p className="mt-1 text-sm text-[#77758A]">
                Correct-answer rate: {percentageLabel(summary.correctAnswerPercentage)}
                {" "}of answered questions (blank answers are not counted here).
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-[#77758A]">Overall improvement trend</p>
              {summary.trendChange === null ? (
                <p className="mt-2 font-semibold text-[#35216B]">
                  Complete another exam to see your trend.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-black text-[#35216B]">
                    {summary.trendChange > 0 ? "+" : ""}
                    {summary.trendChange} percentage points
                  </p>
                  <p className="mt-1 text-sm text-[#77758A]">
                    {summary.trendDirection === "improving"
                      ? "Your latest score is higher than your first."
                      : summary.trendDirection === "declining"
                        ? "Your latest score is lower than your first."
                        : "Your first and latest scores are the same."}
                  </p>
                </>
              )}
            </Card>
          </section>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-xl font-bold text-[#35216B]">Scores over time</h2>
              <p className="mt-1 text-sm text-[#77758A]">
                Your latest {trend.length} submitted examinations.
              </p>
              {!trend.length ? (
                <p className="mt-4 text-sm text-[#77758A]">No scores match these filters.</p>
              ) : (
                <ol className="mt-4 grid gap-3" aria-label="Examination scores over time">
                  {trend.map((entry) => (
                    <li key={entry.attemptId} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#35216B]">
                          {entry.quizTitle}
                        </p>
                        <p className="text-xs text-[#77758A]">{entry.submittedLabel}</p>
                        <div
                          className="mt-1 h-2 overflow-hidden rounded-full bg-[#ECEAF5]"
                          role="progressbar"
                          aria-label={`${entry.quizTitle}, ${entry.percentage}%`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={entry.percentage}
                        >
                          <div
                            className="h-full rounded-full bg-[#7655D9]"
                            style={{ width: `${entry.percentage}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-right font-bold text-[#35216B]">{entry.percentage}%</p>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-xl font-bold text-[#35216B]">Topic progress</h2>
              <p className="mt-1 text-sm text-[#77758A]">
                Progress uses answered questions across your submitted exams. Five responses
                are needed before a topic is classified.
              </p>
              {!topicAnalysisAvailable ? (
                <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900" role="status">
                  Topic analysis is temporarily unavailable because some saved quiz questions
                  could not be validated. Score history remains available.
                </p>
              ) : !topics.length ? (
                <p className="mt-4 text-sm text-[#77758A]">
                  No topic data matches these filters yet.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3">
                  {topics.slice(0, 8).map((topic) => (
                    <li key={topic.name} className="rounded-xl border border-[#ECEAF5] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-[#35216B]">{topic.name}</p>
                        <span className="text-xs font-semibold text-[#77758A]">
                          {classificationLabel(topic.classification)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div
                          className="h-2 flex-1 overflow-hidden rounded-full bg-[#ECEAF5]"
                          role="progressbar"
                          aria-label={`${topic.name}, ${topic.accuracy ?? 0}% of answered questions correct`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={topic.accuracy ?? 0}
                        >
                          <div
                            className={`h-full rounded-full ${classificationColor(topic.classification)}`}
                            style={{ width: `${topic.accuracy ?? 0}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs font-semibold text-[#4E4B60]">
                          {topic.accuracy === null ? "—" : `${topic.accuracy}%`}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#77758A]">
                        {topic.answeredCount} answered · {topic.unansweredCount} unanswered
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <section aria-labelledby="subject-performance-heading" className="mt-6">
            <div className="mb-3">
              <h2 id="subject-performance-heading" className="text-xl font-bold text-[#35216B]">
                Subjects to build on
              </h2>
              <p className="mt-1 text-sm text-[#77758A]">
                A subject is highlighted only after at least five answered questions.
              </p>
            </div>
            {!strongestSubjects.length && !subjectsToReview.length && !developingSubjects.length ? (
              <Card className="p-5 text-sm text-[#77758A]">
                More answered questions are needed before subject-level patterns can be shown.
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {strongestSubjects.map((subject) => (
                  <Card key={`strong-${subject.name}`} className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Strong
                    </p>
                    <h3 className="mt-1 font-bold text-[#35216B]">{subject.name}</h3>
                    <p className="mt-1 text-sm text-[#77758A]">
                      {subject.accuracy}% across {subject.answeredCount} answered questions
                    </p>
                  </Card>
                ))}
                {subjectsToReview.map((subject) => (
                  <Card key={`review-${subject.name}`} className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                      Needs review
                    </p>
                    <h3 className="mt-1 font-bold text-[#35216B]">{subject.name}</h3>
                    <p className="mt-1 text-sm text-[#77758A]">
                      {subject.accuracy}% across {subject.answeredCount} answered questions
                    </p>
                  </Card>
                ))}
                {developingSubjects.map((subject) => (
                  <Card key={`developing-${subject.name}`} className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Developing
                    </p>
                    <h3 className="mt-1 font-bold text-[#35216B]">{subject.name}</h3>
                    <p className="mt-1 text-sm text-[#77758A]">
                      {subject.accuracy}% across {subject.answeredCount} answered questions
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section aria-labelledby="performance-history-heading" className="mt-8">
        <div className="mb-4">
          <p className="text-sm font-bold text-[#7655D9]">Your results</p>
          <h2 id="performance-history-heading" className="mt-1 text-2xl font-black text-[#35216B]">
            Examination history
          </h2>
        </div>
        <Card className="mb-4 p-4">
          <form method="get" action="/dashboard/performance" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="grid gap-1 text-xs font-semibold text-[#4E4B60]">
              Subject
              <select
                name="subject"
                defaultValue={filters.subject ?? ""}
                className="min-h-11 rounded-lg border border-[#DDD8EF] bg-white px-3 text-sm"
              >
                <option value="">All subjects</option>
                {filterOptions.subjects.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#4E4B60]">
              Source document
              <select
                name="source"
                defaultValue={filters.sourceDocumentId ?? ""}
                className="min-h-11 rounded-lg border border-[#DDD8EF] bg-white px-3 text-sm"
              >
                <option value="">All documents</option>
                {filterOptions.sources.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#4E4B60]">
              From
              <input
                type="date"
                name="from"
                defaultValue={filters.fromDate ?? ""}
                className="min-h-11 rounded-lg border border-[#DDD8EF] bg-white px-3 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#4E4B60]">
              To
              <input
                type="date"
                name="to"
                defaultValue={filters.toDate ?? ""}
                className="min-h-11 rounded-lg border border-[#DDD8EF] bg-white px-3 text-sm"
              />
            </label>
            <div className="flex items-end gap-3">
              <button
                type="submit"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#35216B] px-4 text-sm font-semibold text-white hover:bg-[#7655D9]"
              >
                Apply filters
              </button>
              <Link
                href="/dashboard/performance"
                className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-[#7655D9] hover:underline"
              >
                Clear
              </Link>
            </div>
          </form>
        </Card>

        {!attempts.length ? (
          <Card className="p-5 text-sm text-[#77758A]">
            No submitted examinations match these filters.
          </Card>
        ) : (
          <div className="grid gap-3">
            {attempts.map((attempt) => (
              <Card key={attempt.attemptId} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words font-bold text-[#35216B]">{attempt.quizTitle}</h3>
                  <p className="mt-1 text-sm text-[#77758A]">
                    {attempt.subject} · {attempt.sourceFilename}
                  </p>
                  <p className="mt-1 text-xs text-[#77758A]">
                    {attempt.submittedLabel} · {attempt.correctCount} correct · {attempt.incorrectCount} incorrect · {attempt.unansweredCount} unanswered · {attempt.timeTaken}
                  </p>
                  {attempt.previousScore !== null && (
                    <p className="mt-1 text-xs font-semibold text-[#4E4B60]">
                      Previous attempt: {attempt.previousScore}%
                      {" · "}
                      {attempt.percentage - attempt.previousScore > 0 ? "+" : ""}
                      {attempt.percentage - attempt.previousScore} percentage points
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="text-xl font-black text-[#35216B]">{attempt.percentage}%</p>
                  <Link
                    href={`/dashboard/exams/${attempt.attemptId}/results`}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#35216B] px-4 text-sm font-semibold text-white hover:bg-[#7655D9]"
                  >
                    View results
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}

        {(previousPageHref || nextPageHref) && (
          <nav className="mt-4 flex items-center justify-between" aria-label="Examination history pages">
            {previousPageHref ? (
              <Link href={previousPageHref} className="text-sm font-semibold text-[#7655D9] hover:underline">
                Previous
              </Link>
            ) : <span />}
            <span className="text-xs text-[#77758A]">Page {currentPage} of {pageCount}</span>
            {nextPageHref ? (
              <Link href={nextPageHref} className="text-sm font-semibold text-[#7655D9] hover:underline">
                Next
              </Link>
            ) : <span />}
          </nav>
        )}
      </section>
    </div>
  );
}
