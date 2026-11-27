export const XP_PER_LEVEL = 250;

export const BADGE_DEFINITIONS = [
  {
    key: "first_steps",
    title: "First Steps",
    description: "Complete your first examination.",
    requirement: "Complete 1 examination",
  },
  {
    key: "quiz_champion",
    title: "Quiz Champion",
    description: "Score at least 90% in an examination.",
    requirement: "Reach 90% on an examination",
  },
  {
    key: "consistent_learner",
    title: "Consistent Learner",
    description: "Complete examinations on three different UTC dates.",
    requirement: "Complete exams on 3 different days",
  },
  {
    key: "perfect_score",
    title: "Perfect Score",
    description: "Earn 100% in an examination.",
    requirement: "Earn 100% on an examination",
  },
  {
    key: "dedicated_learner",
    title: "Dedicated Learner",
    description: "Complete ten examinations.",
    requirement: "Complete 10 examinations",
  },
  {
    key: "knowledge_seeker",
    title: "Knowledge Seeker",
    description: "Study and analyse three learning materials.",
    requirement: "Analyse 3 learning materials",
  },
] as const;

export type BadgeKey = (typeof BADGE_DEFINITIONS)[number]["key"];

export type BadgeAward = {
  badgeKey: BadgeKey;
  awardedAt: string;
};

export type BadgeProgress = {
  key: BadgeKey;
  title: string;
  description: string;
  requirement: string;
  earnedAt: string | null;
  progress: number;
  target: number;
  unit: "exams" | "days" | "materials" | "percent";
};

export type XpEventType =
  | "exam_complete"
  | "strong_score"
  | "streak"
  | "badge"
  | "milestone";

export type XpActivity = {
  eventType: XpEventType;
  amount: number;
  sourceKey: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type MilestoneProgress = {
  key: string;
  title: string;
  progress: number;
  target: number;
  unit: "exams" | "materials" | "percent";
  earnedAt: string | null;
};

export type LevelProgress = {
  level: number;
  xpIntoLevel: number;
  xpNeededForNextLevel: number;
  progressPercentage: number;
};

function parseUtcDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(milliseconds)) return null;
  if (new Date(milliseconds).toISOString().slice(0, 10) !== value) return null;
  return Math.floor(milliseconds / 86_400_000);
}

function formatUtcDay(dayNumber: number) {
  return new Date(dayNumber * 86_400_000).toISOString().slice(0, 10);
}

export function getLevelProgress(totalXp: number): LevelProgress {
  if (!Number.isSafeInteger(totalXp) || totalXp < 0) {
    throw new Error("Total XP must be a non-negative safe integer.");
  }
  const xpIntoLevel = totalXp % XP_PER_LEVEL;
  return {
    level: Math.floor(totalXp / XP_PER_LEVEL) + 1,
    xpIntoLevel,
    xpNeededForNextLevel: XP_PER_LEVEL - xpIntoLevel,
    progressPercentage: Math.floor((xpIntoLevel / XP_PER_LEVEL) * 100),
  };
}

export function calculateLearningStreak(
  activityDates: string[],
  todayUtc: string,
) {
  const today = parseUtcDay(todayUtc);
  if (today === null) throw new Error("Today must be a valid UTC calendar date.");
  const uniqueDays = [...new Set(
    activityDates.flatMap((date) => {
      const day = parseUtcDay(date);
      return day === null ? [] : [day];
    }),
  )].sort((first, second) => first - second);

  let longestStreak = 0;
  let runLength = 0;
  for (let index = 0; index < uniqueDays.length; index += 1) {
    runLength = index > 0 && uniqueDays[index] === uniqueDays[index - 1] + 1
      ? runLength + 1
      : 1;
    longestStreak = Math.max(longestStreak, runLength);
  }

  let currentStreak = 0;
  const lastDay = uniqueDays.at(-1);
  if (lastDay !== undefined && lastDay >= today - 1) {
    currentStreak = 1;
    for (let index = uniqueDays.length - 1; index > 0; index -= 1) {
      if (uniqueDays[index] !== uniqueDays[index - 1] + 1) break;
      currentStreak += 1;
    }
  }

  return { currentStreak, longestStreak, uniqueDays };
}

export function buildStreakCalendar(
  activityDates: string[],
  todayUtc: string,
) {
  const today = parseUtcDay(todayUtc);
  if (today === null) throw new Error("Today must be a valid UTC calendar date.");
  const activeDates = new Set(
    activityDates.flatMap((date) => {
      const day = parseUtcDay(date);
      return day === null ? [] : [formatUtcDay(day)];
    }),
  );
  return Array.from({ length: 14 }, (_, index) => {
    const day = today - 13 + index;
    const date = formatUtcDay(day);
    return { date, active: activeDates.has(date) };
  });
}

export function buildBadgeProgress(
  {
    completedExams,
    distinctExamDays,
    highestScore,
    analyzedMaterials,
  }: {
    completedExams: number;
    distinctExamDays: number;
    highestScore: number | null;
    analyzedMaterials: number;
  },
  awards: BadgeAward[],
): BadgeProgress[] {
  const awardedAt = new Map(awards.map((award) => [award.badgeKey, award.awardedAt]));
  const progressByBadge: Record<BadgeKey, Pick<BadgeProgress, "progress" | "target" | "unit">> = {
    first_steps: { progress: Math.min(completedExams, 1), target: 1, unit: "exams" },
    quiz_champion: { progress: Math.min(highestScore ?? 0, 90), target: 90, unit: "percent" },
    consistent_learner: { progress: Math.min(distinctExamDays, 3), target: 3, unit: "days" },
    perfect_score: { progress: Math.min(highestScore ?? 0, 100), target: 100, unit: "percent" },
    dedicated_learner: { progress: Math.min(completedExams, 10), target: 10, unit: "exams" },
    knowledge_seeker: { progress: Math.min(analyzedMaterials, 3), target: 3, unit: "materials" },
  };

  return BADGE_DEFINITIONS.map((definition) => ({
    ...definition,
    earnedAt: awardedAt.get(definition.key) ?? null,
    ...progressByBadge[definition.key],
  }));
}

export function buildMilestoneProgress(
  {
    completedExams,
    highestScore,
    analyzedMaterials,
  }: {
    completedExams: number;
    highestScore: number | null;
    analyzedMaterials: number;
  },
  awards: BadgeAward[],
  activities: XpActivity[],
): MilestoneProgress[] {
  const badgeDates = new Map(awards.map((award) => [award.badgeKey, award.awardedAt]));
  const fiveExamAward = activities.find(
    (activity) => activity.sourceKey === "milestone:five_exams",
  );
  return [
    {
      key: "first_exam",
      title: "First examination completed",
      progress: Math.min(completedExams, 1),
      target: 1,
      unit: "exams",
      earnedAt: badgeDates.get("first_steps") ?? null,
    },
    {
      key: "five_exams",
      title: "Five examinations completed",
      progress: Math.min(completedExams, 5),
      target: 5,
      unit: "exams",
      earnedAt: fiveExamAward?.createdAt ?? null,
    },
    {
      key: "ten_exams",
      title: "Ten examinations completed",
      progress: Math.min(completedExams, 10),
      target: 10,
      unit: "exams",
      earnedAt: badgeDates.get("dedicated_learner") ?? null,
    },
    {
      key: "first_90",
      title: "First score of 90% or higher",
      progress: Math.min(highestScore ?? 0, 90),
      target: 90,
      unit: "percent",
      earnedAt: badgeDates.get("quiz_champion") ?? null,
    },
    {
      key: "perfect_score",
      title: "First perfect score",
      progress: Math.min(highestScore ?? 0, 100),
      target: 100,
      unit: "percent",
      earnedAt: badgeDates.get("perfect_score") ?? null,
    },
    {
      key: "three_materials",
      title: "Three learning materials analysed",
      progress: Math.min(analyzedMaterials, 3),
      target: 3,
      unit: "materials",
      earnedAt: badgeDates.get("knowledge_seeker") ?? null,
    },
  ];
}

export function getXpActivityLabel(activity: XpActivity) {
  switch (activity.eventType) {
    case "exam_complete":
      return "Completed an examination";
    case "strong_score":
      return "90% or higher score bonus";
    case "streak":
      return "Maintained a study streak";
    case "badge": {
      const badgeKey = activity.metadata.badge_key;
      const badge = BADGE_DEFINITIONS.find((item) => item.key === badgeKey);
      return badge ? `Unlocked ${badge.title}` : "Unlocked a badge";
    }
    case "milestone":
      return activity.metadata.milestone === "five_exams"
        ? "Five examinations milestone"
        : "Learning milestone";
  }
}
