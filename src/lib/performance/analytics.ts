export type AnswerChoice = "A" | "B" | "C" | "D";

export type PerformanceQuestion = {
  question: string;
  options: { label: AnswerChoice; text: string }[];
  correctAnswer: AnswerChoice;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
  sourceRefs: string[];
};

export type QuestionReview = PerformanceQuestion & {
  index: number;
  selectedAnswer: AnswerChoice | null;
  outcome: "correct" | "incorrect" | "unanswered";
};

export type TopicClassification =
  | "strong"
  | "developing"
  | "needs_review"
  | "insufficient_data";

export type GroupPerformance = {
  name: string;
  questionCount: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  accuracy: number | null;
  classification: TopicClassification;
};

export type AttemptQuestionSet = {
  attemptId: string;
  subject: string;
  questions: PerformanceQuestion[];
  answers: (AnswerChoice | null)[];
};

export type CompletedAttemptMetric = {
  attemptId: string;
  submittedAt: string;
  percentage: number;
  questionCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
};

export const MIN_RESPONSES_FOR_CLASSIFICATION = 5;

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

export function buildQuestionReviews(
  questions: PerformanceQuestion[],
  answers: (AnswerChoice | null)[],
): QuestionReview[] {
  if (questions.length !== answers.length) {
    throw new Error("The answer count does not match the question count.");
  }

  return questions.map((question, index) => {
    const selectedAnswer = answers[index];
    return {
      ...question,
      index,
      selectedAnswer,
      outcome: selectedAnswer === null
        ? "unanswered"
        : selectedAnswer === question.correctAnswer
          ? "correct"
          : "incorrect",
    };
  });
}

function getClassification(
  answeredCount: number,
  accuracy: number | null,
): TopicClassification {
  if (answeredCount < MIN_RESPONSES_FOR_CLASSIFICATION || accuracy === null) {
    return "insufficient_data";
  }
  if (accuracy >= 80) return "strong";
  if (accuracy <= 60) return "needs_review";
  return "developing";
}

function groupQuestionPerformance(
  reviews: QuestionReview[],
  groupName: (review: QuestionReview) => string,
): GroupPerformance[] {
  const grouped = new Map<string, QuestionReview[]>();
  for (const review of reviews) {
    const name = groupName(review).trim() || "Uncategorised";
    const entries = grouped.get(name) ?? [];
    entries.push(review);
    grouped.set(name, entries);
  }

  return [...grouped.entries()]
    .map(([name, entries]) => {
      const correctCount = entries.filter((entry) => entry.outcome === "correct").length;
      const incorrectCount = entries.filter((entry) => entry.outcome === "incorrect").length;
      const unansweredCount = entries.filter((entry) => entry.outcome === "unanswered").length;
      const answeredCount = correctCount + incorrectCount;
      const accuracy = answeredCount
        ? roundToOneDecimal((correctCount / answeredCount) * 100)
        : null;
      return {
        name,
        questionCount: entries.length,
        answeredCount,
        correctCount,
        incorrectCount,
        unansweredCount,
        accuracy,
        classification: getClassification(answeredCount, accuracy),
      };
    })
    .sort((first, second) =>
      second.questionCount - first.questionCount ||
      first.name.localeCompare(second.name),
    );
}

export function buildTopicPerformance(
  attempts: AttemptQuestionSet[],
): GroupPerformance[] {
  const seenAttempts = new Set<string>();
  const reviews = attempts.flatMap((attempt) => {
    if (seenAttempts.has(attempt.attemptId)) return [];
    seenAttempts.add(attempt.attemptId);
    return buildQuestionReviews(attempt.questions, attempt.answers);
  });
  return groupQuestionPerformance(reviews, (review) => review.topic);
}

export function buildSubjectPerformance(
  attempts: AttemptQuestionSet[],
): GroupPerformance[] {
  const seenAttempts = new Set<string>();
  const reviews = attempts.flatMap((attempt) => {
    if (seenAttempts.has(attempt.attemptId)) return [];
    seenAttempts.add(attempt.attemptId);
    return buildQuestionReviews(attempt.questions, attempt.answers)
      .map((review) => ({ ...review, topic: attempt.subject }));
  });
  return groupQuestionPerformance(reviews, (review) => review.topic);
}

export function getPerformanceClassification(percentage: number) {
  if (percentage >= 90) return "Excellent";
  if (percentage >= 75) return "Strong";
  if (percentage >= 50) return "Developing";
  return "Needs practice";
}

export function getTimeTakenMilliseconds(
  startedAt: string,
  submittedAt: string,
  deadlineAt: string,
) {
  const started = Date.parse(startedAt);
  const submitted = Date.parse(submittedAt);
  const deadline = Date.parse(deadlineAt);
  if (![started, submitted, deadline].every(Number.isFinite)) return null;
  return Math.max(0, Math.min(submitted - started, deadline - started));
}

export function formatTimeTaken(milliseconds: number | null) {
  if (milliseconds === null) return "Unavailable";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function summarizeCompletedAttempts(
  sourceAttempts: CompletedAttemptMetric[],
) {
  const uniqueAttempts = [
    ...new Map(sourceAttempts.map((attempt) => [attempt.attemptId, attempt])).values(),
  ];
  const completedCount = uniqueAttempts.length;
  const percentages = uniqueAttempts.map((attempt) => attempt.percentage);
  const totalAnsweredQuestions = uniqueAttempts.reduce(
    (total, attempt) => total + attempt.correctCount + attempt.incorrectCount,
    0,
  );
  const totalCorrectAnswers = uniqueAttempts.reduce(
    (total, attempt) => total + attempt.correctCount,
    0,
  );
  const chronological = uniqueAttempts.slice().sort(
    (first, second) =>
      Date.parse(first.submittedAt) - Date.parse(second.submittedAt),
  );
  const firstScore = chronological[0]?.percentage;
  const latestScore = chronological.at(-1)?.percentage;
  const trendChange =
    firstScore === undefined || latestScore === undefined || completedCount < 2
      ? null
      : roundToOneDecimal(latestScore - firstScore);
  const trendDirection: "insufficient_data" | "improving" | "declining" | "steady" =
    trendChange === null
      ? "insufficient_data"
      : trendChange > 0
        ? "improving"
        : trendChange < 0
          ? "declining"
          : "steady";

  return {
    completedCount,
    averageScore: completedCount
      ? roundToOneDecimal(percentages.reduce((sum, score) => sum + score, 0) / completedCount)
      : null,
    highestScore: completedCount ? Math.max(...percentages) : null,
    lowestScore: completedCount ? Math.min(...percentages) : null,
    totalAnsweredQuestions,
    correctAnswerPercentage: totalAnsweredQuestions
      ? roundToOneDecimal((totalCorrectAnswers / totalAnsweredQuestions) * 100)
      : null,
    trendChange,
    trendDirection,
  };
}
