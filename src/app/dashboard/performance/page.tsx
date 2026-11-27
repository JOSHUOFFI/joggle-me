import { AppShell } from "@/components/app-shell";
import {
  PerformanceDashboard,
  type PerformanceFilterOption,
  type PerformanceHistoryEntry,
} from "@/components/performance-dashboard";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import {
  buildSubjectPerformance,
  buildTopicPerformance,
  formatTimeTaken,
  getTimeTakenMilliseconds,
  summarizeCompletedAttempts,
  type AttemptQuestionSet,
  type CompletedAttemptMetric,
} from "@/lib/performance/analytics";
import {
  loadLearnerPerformance,
  PerformanceDataError,
  type PerformanceAttemptRecord,
} from "@/lib/performance/data";
import {
  filterPerformanceAttempts,
  parsePerformanceFilters,
  type PerformanceFilters,
  type PerformanceSearchParams,
} from "@/lib/performance/filters";
import { logger } from "@/lib/logger";

const HISTORY_PAGE_SIZE = 20;

function formatSubmittedDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function createPageHref(filters: PerformanceFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.subject) params.set("subject", filters.subject);
  if (filters.sourceDocumentId) params.set("source", filters.sourceDocumentId);
  if (filters.fromDate) params.set("from", filters.fromDate);
  if (filters.toDate) params.set("to", filters.toDate);
  params.set("page", String(page));
  return `/dashboard/performance?${params.toString()}`;
}

function getFilterOptions(
  attempts: PerformanceAttemptRecord[],
): { subjects: PerformanceFilterOption[]; sources: PerformanceFilterOption[] } {
  const subjects = [...new Set(attempts.map((attempt) => attempt.subject))]
    .sort((first, second) => first.localeCompare(second))
    .map((subject) => ({ value: subject, label: subject }));
  const sources = new Map<string, string>();
  for (const attempt of attempts) {
    sources.set(attempt.sourceDocumentId, attempt.sourceFilename);
  }
  return {
    subjects,
    sources: [...sources.entries()]
      .sort((first, second) => first[1].localeCompare(second[1]))
      .map(([value, label]) => ({ value, label })),
  };
}

function buildHistoryEntries(
  allAttempts: PerformanceAttemptRecord[],
  visibleAttempts: PerformanceAttemptRecord[],
): PerformanceHistoryEntry[] {
  const previousScores = new Map<string, number | null>();
  const lastScoreByQuiz = new Map<string, number>();
  const chronological = allAttempts.slice().sort(
    (first, second) => Date.parse(first.submittedAt) - Date.parse(second.submittedAt),
  );
  for (const attempt of chronological) {
    previousScores.set(attempt.attemptId, lastScoreByQuiz.get(attempt.quizId) ?? null);
    lastScoreByQuiz.set(attempt.quizId, attempt.percentage);
  }

  return visibleAttempts.map((attempt) => ({
    attemptId: attempt.attemptId,
    quizId: attempt.quizId,
    quizTitle: attempt.quizTitle,
    sourceDocumentId: attempt.sourceDocumentId,
    sourceFilename: attempt.sourceFilename,
    subject: attempt.subject,
    submittedAt: attempt.submittedAt,
    submittedLabel: formatSubmittedDate(attempt.submittedAt),
    percentage: attempt.percentage,
    correctCount: attempt.correctCount,
    incorrectCount: attempt.incorrectCount,
    unansweredCount: attempt.unansweredCount,
    timeTaken: formatTimeTaken(
      getTimeTakenMilliseconds(
        attempt.startedAt,
        attempt.submittedAt,
        attempt.deadlineAt,
      ),
    ),
    previousScore: previousScores.get(attempt.attemptId) ?? null,
  }));
}

function toQuestionSets(attempts: PerformanceAttemptRecord[]): AttemptQuestionSet[] {
  return attempts.flatMap((attempt) => attempt.questions
    ? [{
        attemptId: attempt.attemptId,
        subject: attempt.subject,
        questions: attempt.questions,
        answers: attempt.answers,
      }]
    : []);
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<PerformanceSearchParams>;
}) {
  const { supabase, user } = await requireRole(["learner"]);
  const params = await searchParams;
  const parsedFilters = parsePerformanceFilters(params);
  const defaultFilters = parsePerformanceFilters({});
  const filters = parsedFilters.valid
    ? parsedFilters.filters
    : defaultFilters.valid
      ? defaultFilters.filters
      : { page: 1 };

  let allAttempts: PerformanceAttemptRecord[];
  try {
    allAttempts = await loadLearnerPerformance(supabase, user.id);
  } catch (error) {
    if (!(error instanceof PerformanceDataError)) throw error;
    logger.warn("Learner performance dashboard could not load", {
      userId: user.id,
    });
    return (
      <AppShell>
        <Card className="p-6" role="alert">
          <h1 className="text-2xl font-black text-[#35216B]">My Performance</h1>
          <p className="mt-2 text-sm text-[#77758A]">
            Your performance information could not be loaded. Please try again later.
          </p>
        </Card>
      </AppShell>
    );
  }

  const filteredAttempts = filterPerformanceAttempts(allAttempts, filters)
    .sort((first, second) =>
      Date.parse(second.submittedAt) - Date.parse(first.submittedAt),
    );
  const metrics: CompletedAttemptMetric[] = filteredAttempts.map((attempt) => ({
    attemptId: attempt.attemptId,
    submittedAt: attempt.submittedAt,
    percentage: attempt.percentage,
    questionCount: attempt.questionCount,
    correctCount: attempt.correctCount,
    incorrectCount: attempt.incorrectCount,
    unansweredCount: attempt.unansweredCount,
  }));
  const summary = summarizeCompletedAttempts(metrics);
  const questionSets = toQuestionSets(filteredAttempts);
  const topicAnalysisAvailable =
    filteredAttempts.length === questionSets.length;
  const topics = topicAnalysisAvailable
    ? buildTopicPerformance(questionSets)
    : [];
  const subjects = topicAnalysisAvailable
    ? buildSubjectPerformance(questionSets)
    : [];
  const chronological = filteredAttempts.slice().sort(
    (first, second) => Date.parse(first.submittedAt) - Date.parse(second.submittedAt),
  );
  const trend = chronological.slice(-8).map((attempt) => ({
    attemptId: attempt.attemptId,
    quizTitle: attempt.quizTitle,
    submittedLabel: formatSubmittedDate(attempt.submittedAt),
    percentage: attempt.percentage,
  }));
  const pageCount = Math.max(1, Math.ceil(filteredAttempts.length / HISTORY_PAGE_SIZE));
  const currentPage = Math.min(filters.page, pageCount);
  const start = (currentPage - 1) * HISTORY_PAGE_SIZE;
  const historyAttempts = filteredAttempts.slice(start, start + HISTORY_PAGE_SIZE);
  const history = buildHistoryEntries(filteredAttempts, historyAttempts);
  const filterOptions = getFilterOptions(allAttempts);

  return (
    <AppShell>
      {!parsedFilters.valid && (
        <Card className="mb-5 p-4 text-sm text-amber-900" role="alert">
          One or more filters were invalid. Showing results without those filters.
        </Card>
      )}
      <PerformanceDashboard
        summary={summary}
        attempts={history}
        topics={topics}
        subjects={subjects}
        trend={trend}
        filterOptions={filterOptions}
        filters={filters}
        currentPage={currentPage}
        pageCount={pageCount}
        previousPageHref={currentPage > 1 ? createPageHref(filters, currentPage - 1) : null}
        nextPageHref={currentPage < pageCount ? createPageHref(filters, currentPage + 1) : null}
        topicAnalysisAvailable={topicAnalysisAvailable}
      />
    </AppShell>
  );
}
