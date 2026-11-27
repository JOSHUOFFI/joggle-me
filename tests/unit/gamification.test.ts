import { describe, expect, it } from "vitest";
import {
  buildBadgeProgress,
  buildMilestoneProgress,
  calculateLearningStreak,
  getLevelProgress,
  type BadgeAward,
  type XpActivity,
} from "@/lib/gamification/metrics";

describe("gamification metrics", () => {
  it("calculates level progression and remaining XP at exact thresholds", () => {
    expect(getLevelProgress(0)).toMatchObject({
      level: 1,
      xpIntoLevel: 0,
      xpNeededForNextLevel: 250,
      progressPercentage: 0,
    });
    expect(getLevelProgress(249)).toMatchObject({
      level: 1,
      xpIntoLevel: 249,
      xpNeededForNextLevel: 1,
      progressPercentage: 99,
    });
    expect(getLevelProgress(250)).toMatchObject({
      level: 2,
      xpIntoLevel: 0,
      xpNeededForNextLevel: 250,
      progressPercentage: 0,
    });
  });

  it("counts unique consecutive UTC activity days and ignores duplicate same-day exams", () => {
    expect(calculateLearningStreak(
      [
        "2026-03-01",
        "2026-03-02",
        "2026-03-02",
        "2026-03-03",
      ],
      "2026-03-04",
    )).toMatchObject({
      currentStreak: 3,
      longestStreak: 3,
      uniqueDays: [
        Date.UTC(2026, 2, 1) / 86_400_000,
        Date.UTC(2026, 2, 2) / 86_400_000,
        Date.UTC(2026, 2, 3) / 86_400_000,
      ],
    });
  });

  it("retains the longest streak but ends a current streak after a missed UTC day", () => {
    expect(calculateLearningStreak(
      ["2026-03-01", "2026-03-02", "2026-03-04"],
      "2026-03-06",
    )).toMatchObject({ currentStreak: 0, longestStreak: 2 });
  });

  it("derives badge and milestone progress from completed exams, scores, days, and materials", () => {
    const awards: BadgeAward[] = [{
      badgeKey: "first_steps",
      awardedAt: "2026-03-01T10:00:00Z",
    }];
    const activities: XpActivity[] = [{
      eventType: "milestone",
      amount: 25,
      sourceKey: "milestone:five_exams",
      createdAt: "2026-03-05T10:00:00Z",
      metadata: { milestone: "five_exams" },
    }];
    const metrics = {
      completedExams: 5,
      distinctExamDays: 2,
      highestScore: 90,
      analyzedMaterials: 2,
    };
    const badges = buildBadgeProgress(metrics, awards);
    const milestones = buildMilestoneProgress(metrics, awards, activities);

    expect(badges.find((badge) => badge.key === "first_steps")).toMatchObject({
      earnedAt: "2026-03-01T10:00:00Z",
      progress: 1,
      target: 1,
    });
    expect(badges.find((badge) => badge.key === "consistent_learner")).toMatchObject({
      earnedAt: null,
      progress: 2,
      target: 3,
    });
    expect(badges.find((badge) => badge.key === "quiz_champion")).toMatchObject({
      progress: 90,
      target: 90,
    });
    expect(milestones.find((milestone) => milestone.key === "five_exams")).toMatchObject({
      progress: 5,
      target: 5,
      earnedAt: "2026-03-05T10:00:00Z",
    });
    expect(milestones.find((milestone) => milestone.key === "three_materials")).toMatchObject({
      progress: 2,
      target: 3,
      earnedAt: null,
    });
  });
});
