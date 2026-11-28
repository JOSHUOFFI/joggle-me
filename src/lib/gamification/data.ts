import "server-only";
import { z } from "zod";
import type { DatabaseClient } from "@/lib/supabase/types";
import { logger } from "@/lib/logger";
import {
  BADGE_DEFINITIONS,
  buildBadgeProgress,
  buildMilestoneProgress,
  buildStreakCalendar,
  calculateLearningStreak,
  getLevelProgress,
  type BadgeAward,
  type BadgeKey,
  type XpActivity,
} from "@/lib/gamification/metrics";

const xpActivitySchema = z.object({
  event_type: z.enum(["exam_complete", "strong_score", "streak", "badge", "milestone"]),
  amount: z.number().int().positive(),
  source_key: z.string().min(1).max(160),
  created_at: z.iso.datetime({ offset: true }),
  metadata: z.record(z.string(), z.unknown()),
});

const badgeRowSchema = z.object({
  badge_key: z.enum([
    "first_steps",
    "quiz_champion",
    "consistent_learner",
    "perfect_score",
    "dedicated_learner",
    "knowledge_seeker",
  ]),
  awarded_at: z.iso.datetime({ offset: true }),
});

const activityDaySchema = z.object({
  activity_date: z.iso.date(),
});

const completedAttemptSchema = z.object({
  percentage: z.number().min(0).max(100),
  submitted_at: z.iso.datetime({ offset: true }),
});

export class GamificationDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GamificationDataError";
  }
}

export type GamificationDashboardData = {
  totalXp: number;
  level: ReturnType<typeof getLevelProgress>;
  currentStreak: number;
  longestStreak: number;
  streakCalendar: ReturnType<typeof buildStreakCalendar>;
  badges: ReturnType<typeof buildBadgeProgress>;
  milestones: ReturnType<typeof buildMilestoneProgress>;
  recentActivities: XpActivity[];
  recentRewards: {
    xpEarned: number;
    badgeTitles: string[];
    milestoneTitles: string[];
    newLevels: number[];
  };
};

function logAndThrow(message: string, context: { code?: string | null } = {}): never {
  logger.error("Gamification dashboard data could not be loaded", {
    code: context.code ?? null,
  });
  throw new GamificationDataError(message);
}

function labelBadge(badgeKey: BadgeKey) {
  return BADGE_DEFINITIONS.find((badge) => badge.key === badgeKey)?.title ??
    "Achievement";
}

export async function loadGamificationDashboard(
  supabase: DatabaseClient,
  userId: string,
  now = new Date(),
): Promise<GamificationDashboardData> {
  const pageSize = 500;
  const [badgeResult, activityResult, materialResult] = await Promise.all([
    supabase
      .from("learner_badges")
      .select("badge_key,awarded_at")
      .eq("user_id", userId)
      .order("awarded_at", { ascending: true }),
    supabase
      .from("learner_activity_days")
      .select("activity_date")
      .eq("user_id", userId)
      .order("activity_date", { ascending: true }),
    supabase
      .from("learning_documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("analysis_status", "ready"),
  ]);
  if (badgeResult.error) {
    logAndThrow("Your achievements could not be loaded.", { code: badgeResult.error.code });
  }
  if (activityResult.error) {
    logAndThrow("Your learning streak could not be loaded.", {
      code: activityResult.error.code,
    });
  }
  if (materialResult.error || materialResult.count === null) {
    logAndThrow("Your analysed learning materials could not be counted.", {
      code: materialResult.error?.code,
    });
  }

  const parsedBadges = z.array(badgeRowSchema).safeParse(badgeResult.data);
  const parsedActivityDays = z.array(activityDaySchema).safeParse(activityResult.data);
  if (!parsedBadges.success || !parsedActivityDays.success) {
    logAndThrow("Your gamification records could not be validated.");
  }
  const awards: BadgeAward[] = parsedBadges.data.map((badge) => ({
    badgeKey: badge.badge_key,
    awardedAt: badge.awarded_at,
  }));
  const activityDates = parsedActivityDays.data.map((day) => day.activity_date);
  const examRows: z.infer<typeof completedAttemptSchema>[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("percentage,submitted_at")
      .eq("user_id", userId)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      logAndThrow("Your completed examinations could not be loaded.", {
        code: error.code,
      });
    }
    const parsedRows = z.array(completedAttemptSchema).safeParse(data);
    if (!parsedRows.success) {
      logAndThrow("Your completed examinations could not be validated.");
    }
    examRows.push(...parsedRows.data);
    if (parsedRows.data.length < pageSize) break;
    offset += pageSize;
  }

  const xpRows: z.infer<typeof xpActivitySchema>[] = [];
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("learner_xp_transactions")
      .select("event_type,amount,source_key,created_at,metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("source_key", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      logAndThrow("Your XP history could not be loaded.", { code: error.code });
    }
    const parsedRows = z.array(xpActivitySchema).safeParse(data);
    if (!parsedRows.success) {
      logAndThrow("Your XP history could not be validated.");
    }
    xpRows.push(...parsedRows.data);
    if (parsedRows.data.length < pageSize) break;
    offset += pageSize;
  }

  const activities: XpActivity[] = xpRows.map((row) => ({
    eventType: row.event_type,
    amount: row.amount,
    sourceKey: row.source_key,
    createdAt: row.created_at,
    metadata: row.metadata,
  }));
  const totalXp = activities.reduce((total, activity) => total + activity.amount, 0);
  const level = getLevelProgress(totalXp);
  const todayUtc = now.toISOString().slice(0, 10);
  const streak = calculateLearningStreak(activityDates, todayUtc);
  const highestScore = examRows.reduce<number | null>(
    (highest, attempt) => Math.max(highest ?? 0, attempt.percentage),
    null,
  );
  const progressMetrics = {
    completedExams: examRows.length,
    distinctExamDays: streak.uniqueDays.length,
    highestScore,
    analyzedMaterials: materialResult.count,
  };

  const recentCutoff = now.getTime() - 24 * 60 * 60 * 1000;
  const recentActivities = activities.filter(
    (activity) => Date.parse(activity.createdAt) >= recentCutoff,
  );
  const recentBadgeKeys = new Set(
    awards
      .filter((award) => Date.parse(award.awardedAt) >= recentCutoff)
      .map((award) => award.badgeKey),
  );
  const levelSet = new Set<number>();
  let runningXp = 0;
  for (const activity of activities) {
    const previousLevel = getLevelProgress(runningXp).level;
    runningXp += activity.amount;
    const nextLevel = getLevelProgress(runningXp).level;
    if (
      nextLevel > previousLevel &&
      Date.parse(activity.createdAt) >= recentCutoff
    ) {
      levelSet.add(nextLevel);
    }
  }

  return {
    totalXp,
    level,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    streakCalendar: buildStreakCalendar(activityDates, todayUtc),
    badges: buildBadgeProgress(progressMetrics, awards),
    milestones: buildMilestoneProgress(progressMetrics, awards, activities),
    recentActivities: activities.slice(-8).reverse(),
    recentRewards: {
      xpEarned: recentActivities.reduce((total, activity) => total + activity.amount, 0),
      badgeTitles: [...recentBadgeKeys].map(labelBadge),
      milestoneTitles: recentActivities
        .filter((activity) => activity.eventType === "milestone")
        .map((activity) =>
          activity.metadata.milestone === "five_exams"
            ? "Five examinations completed"
            : "Learning milestone",
        ),
      newLevels: [...levelSet].sort((first, second) => first - second),
    },
  };
}
