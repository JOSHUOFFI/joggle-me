import { Card } from "@/components/ui/card";
import type { GamificationDashboardData } from "@/lib/gamification/data";
import { getXpActivityLabel } from "@/lib/gamification/metrics";

function formatUtcDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function progressText(progress: number, target: number, unit: string) {
  if (unit === "percent") return `${progress}% / ${target}%`;
  return `${progress} / ${target} ${unit}`;
}

export function GamificationDashboard({
  data,
}: {
  data: GamificationDashboardData;
}) {
  const earnedBadges = data.badges.filter((badge) => badge.earnedAt);
  const hasRecentReward =
    data.recentRewards.xpEarned > 0 ||
    data.recentRewards.badgeTitles.length > 0 ||
    data.recentRewards.milestoneTitles.length > 0 ||
    data.recentRewards.newLevels.length > 0;

  return (
    <section id="gamification" aria-labelledby="gamification-heading" className="mt-6 scroll-mt-24">
      <div className="mb-4">
        <p className="text-sm font-bold text-[#7655D9]">Keep your momentum</p>
        <h2 id="gamification-heading" className="mt-1 text-2xl font-black text-[#35216B]">
          Achievements
        </h2>
        <p className="mt-1 text-sm leading-6 text-[#77758A]">
          Your learning progress, experience points and recent achievements.
        </p>
      </div>

      {hasRecentReward && (
        <Card className="mb-4 border border-emerald-200 bg-emerald-50 p-4" role="status">
          <p className="font-bold text-emerald-900">
            {data.recentRewards.newLevels.length
              ? `Level up! You reached Level ${data.recentRewards.newLevels.at(-1)}.`
              : data.recentRewards.badgeTitles.length
                ? `Achievement unlocked: ${data.recentRewards.badgeTitles.join(", ")}.`
                : data.recentRewards.milestoneTitles.length
                  ? `Milestone reached: ${data.recentRewards.milestoneTitles.join(", ")}.`
                  : `You earned ${data.recentRewards.xpEarned} XP from recent learning.`}
          </p>
          {data.recentRewards.xpEarned > 0 && (
            <p className="mt-1 text-sm text-emerald-800">
              +{data.recentRewards.xpEarned} XP earned in the last 24 hours.
            </p>
          )}
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-[#77758A]">Total XP</p>
          <p className="mt-2 text-3xl font-black text-[#35216B]">{data.totalXp}</p>
          <p className="mt-1 text-xs text-[#77758A]">Experience points earned</p>
        </Card>

        <Card className="p-5 sm:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-[#77758A]">Current level</p>
              <p className="mt-1 text-2xl font-black text-[#35216B]">Level {data.level.level}</p>
            </div>
            <p className="text-right text-xs font-semibold text-[#77758A]">
              {data.level.xpNeededForNextLevel} XP to next level
            </p>
          </div>
          <div
            className="mt-4 h-3 overflow-hidden rounded-full bg-[#ECEAF5]"
            role="progressbar"
            aria-label={`Level ${data.level.level} progress`}
            aria-valuemin={0}
            aria-valuemax={250}
            aria-valuenow={data.level.xpIntoLevel}
          >
            <div
              className="h-full rounded-full bg-[#7655D9]"
              style={{ width: `${data.level.progressPercentage}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[#77758A]">
            {data.level.xpIntoLevel} of 250 XP toward Level {data.level.level + 1}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-[#77758A]">Current streak</p>
          <p className="mt-2 text-3xl font-black text-[#35216B]">
            {data.currentStreak} {data.currentStreak === 1 ? "day" : "days"}
          </p>
          <p className="mt-1 text-xs text-[#77758A]">
            Longest: {data.longestStreak} {data.longestStreak === 1 ? "day" : "days"}
          </p>
        </Card>
      </div>

      <details className="dashboard-gamification-details mt-4">
        <summary>View streak history, milestones and all badges</summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-lg font-bold text-[#35216B]">Your study streak</h3>
          <p className="mt-1 text-sm text-[#77758A]">
            Complete an examination on consecutive UTC days to keep your streak active.
          </p>
          <ol className="mt-4 grid grid-cols-7 gap-2" aria-label="Last 14 UTC days of examination activity">
            {data.streakCalendar.map((day) => {
              const date = new Date(`${day.date}T00:00:00.000Z`);
              const accessibleDate = new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
                timeZone: "UTC",
              }).format(date);
              return (
                <li key={day.date} className="flex flex-col items-center gap-1">
                  <span
                    className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                      day.active
                        ? "bg-emerald-500 text-white"
                        : "bg-[#F0EEF7] text-[#77758A]"
                    }`}
                    aria-label={`${accessibleDate}: ${day.active ? "exam completed" : "no exam"}`}
                    title={`${accessibleDate}: ${day.active ? "exam completed" : "no exam"}`}
                  >
                    {date.getUTCDate()}
                  </span>
                  <span className="text-[10px] text-[#77758A]">
                    {new Intl.DateTimeFormat("en", {
                      weekday: "short",
                      timeZone: "UTC",
                    }).format(date)}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card className="p-5">
          <h3 className="text-lg font-bold text-[#35216B]">Learning milestones</h3>
          <ul className="mt-3 grid gap-3">
            {data.milestones.map((milestone) => {
              const complete = milestone.earnedAt !== null;
              const percentage = Math.min(
                100,
                Math.floor((milestone.progress / milestone.target) * 100),
              );
              const unit = milestone.unit === "percent" ? "%" : milestone.unit;
              return (
                <li key={milestone.key} className="rounded-xl border border-[#ECEAF5] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#35216B]">{milestone.title}</p>
                    <span className={`text-xs font-semibold ${complete ? "text-emerald-700" : "text-[#77758A]"}`}>
                      {complete && milestone.earnedAt
                        ? `Completed ${formatUtcDate(milestone.earnedAt)}`
                        : "In progress"}
                    </span>
                  </div>
                  {!complete && (
                    <>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ECEAF5]">
                        <div
                          className="h-full rounded-full bg-[#7655D9]"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-[#77758A]">
                        {progressText(milestone.progress, milestone.target, unit)}
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-lg font-bold text-[#35216B]">Badges and achievements</h3>
          {earnedBadges.length === 0 && (
            <p className="mt-2 text-sm text-[#77758A]">
              Complete an examination or analyse learning materials to unlock your first badge.
            </p>
          )}
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {data.badges.map((badge) => (
              <li
                key={badge.key}
                className={`rounded-xl border p-4 ${
                  badge.earnedAt
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-[#ECEAF5] bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-[#35216B]">{badge.title}</h4>
                  <span className={`text-xs font-semibold ${badge.earnedAt ? "text-emerald-700" : "text-[#77758A]"}`}>
                    {badge.earnedAt ? "Earned" : "Locked"}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[#77758A]">{badge.description}</p>
                {badge.earnedAt ? (
                  <p className="mt-2 text-xs font-semibold text-emerald-800">
                    Earned {formatUtcDate(badge.earnedAt)}
                  </p>
                ) : (
                  <>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ECEAF5]">
                      <div
                        className="h-full rounded-full bg-[#7655D9]"
                        style={{
                          width: `${Math.min(100, Math.floor((badge.progress / badge.target) * 100))}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-[#77758A]">
                      {badge.requirement} · {progressText(badge.progress, badge.target, badge.unit)}
                    </p>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h3 className="text-lg font-bold text-[#35216B]">Recent XP activities</h3>
          {data.recentActivities.length ? (
            <ul className="mt-3 divide-y divide-[#ECEAF5]">
              {data.recentActivities.map((activity) => (
                <li
                  key={activity.sourceKey}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#35216B]">
                      {getXpActivityLabel(activity)}
                    </p>
                    <p className="mt-1 text-xs text-[#77758A]">
                      {formatUtcDate(activity.createdAt)}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold text-emerald-700">+{activity.amount} XP</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[#77758A]">
              Your XP activities will appear here after you complete an examination.
            </p>
          )}
        </Card>
        </div>
      </details>
    </section>
  );
}
