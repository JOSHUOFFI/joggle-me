import { requireGuestWorkspace } from "@/lib/guest-workspace";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { GamificationDashboard } from "@/components/gamification-dashboard";
import {
  GamificationDataError,
  loadGamificationDashboard,
} from "@/lib/gamification/data";
import type { GamificationDashboardData } from "@/lib/gamification/data";
import { loadDashboardOverview } from "@/lib/dashboard/overview";
import {
  ContinueLearning,
  DashboardStats,
  DashboardWelcome,
  PerformancePreview,
  RecentActivity,
  RecentMaterialsPreview,
  RecentQuizzesPreview,
  RecommendationPanel,
} from "@/components/dashboard-overview";
import { DashboardCommunityPreview } from "@/components/dashboard-community-preview";

export default async function DashboardPage() {
  const { supabase, user } = await requireGuestWorkspace();
  const { data: workspace } = await supabase
    .from("guest_workspaces")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const name = workspace?.display_name ?? "Learner";
  const [overview, gamification] = await Promise.all([
    loadDashboardOverview(supabase, user.id),
    loadGamificationDashboardSafely(supabase, user.id),
  ]);

  return (
    <AppShell learnerName={name}>
      <div className="dashboard-home space-y-6">
        <DashboardWelcome name={name.split(" ")[0]} />
        {overview && (
          <>
            <DashboardStats data={overview} gamification={gamification?.data ?? null} />
            <div className="grid gap-4 xl:grid-cols-2">
              <ContinueLearning data={overview} />
              <RecommendationPanel data={overview} />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <RecentMaterialsPreview data={overview} />
              <RecentQuizzesPreview data={overview} />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <PerformancePreview data={overview} />
              <RecentActivity data={overview} />
            </div>
            <DashboardCommunityPreview
              supabase={supabase}
              userId={user.id}
              guestTokenHash={user.guestTokenHash}
            />
            {gamification && <GamificationSection data={gamification.data} loadError={gamification.error} />}
          </>
        )}
      </div>
    </AppShell>
  );
}

async function loadGamificationDashboardSafely(
  supabase: Awaited<ReturnType<typeof requireGuestWorkspace>>["supabase"],
  userId: string,
): Promise<{ data: GamificationDashboardData | null; error: GamificationDataError | null }> {
  try {
    return { data: await loadGamificationDashboard(supabase, userId), error: null };
  } catch (error) {
    if (!(error instanceof GamificationDataError)) throw error;
    return { data: null, error };
  }
}

function GamificationSection({ data, loadError }: {
  data: GamificationDashboardData | null;
  loadError: GamificationDataError | null;
}) {
  if (loadError) {
    return (
      <section id="gamification" aria-labelledby="gamification-heading" className="mt-6">
        <h2
          id="gamification-heading"
          className="mb-3 text-2xl font-black text-[#35216B]"
        >
          Achievements
        </h2>
        <Card className="p-5 text-sm text-amber-900" role="alert">
          {loadError.message}
        </Card>
      </section>
    );
  }
  if (!data) return null;
  return <GamificationDashboard data={data} />;
}

