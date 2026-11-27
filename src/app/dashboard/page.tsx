import { parseAppRoles, requireAuthenticatedUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { LearningMaterials } from "@/components/learning-materials";
import { Card } from "@/components/ui/card";
import { getMaxUploadBytes } from "@/lib/materials/files";
import { isFeatureEnabled } from "@/lib/features";
import { QuizDashboardSection } from "@/components/quiz-library";
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ materials_error?: string }>;
}) {
  const { supabase, user } = await requireAuthenticatedUser();
  const [{ data: profile }, { data: roleRows }, params] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name,last_name,learner_category")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("get_my_roles"),
    searchParams,
  ]);
  const isLearner = parseAppRoles(roleRows).includes("learner");

  const name = profile?.first_name
    ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`
    : "Learner";
  const [overview, gamification] = isLearner
    ? await Promise.all([
        loadDashboardOverview(supabase, user.id),
        loadGamificationDashboardSafely(supabase, user.id),
      ])
    : [null, null];

  return (
    <AppShell learnerName={name}>
      <div className="dashboard-home space-y-6">
        <DashboardWelcome name={name.split(" ")[0]} />
        {isLearner && overview && (
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
            <DashboardCommunityPreview supabase={supabase} userId={user.id} />
            {gamification && <GamificationSection data={gamification.data} loadError={gamification.error} />}
            <LearnerMaterialsSection
              supabase={supabase}
              userId={user.id}
              maxUploadBytes={getMaxUploadBytes()}
              actionError={params.materials_error}
            />
            <QuizDashboardSection supabase={supabase} userId={user.id} />
          </>
        )}
      </div>
    </AppShell>
  );
}

async function loadGamificationDashboardSafely(
  supabase: Awaited<ReturnType<typeof requireAuthenticatedUser>>["supabase"],
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

async function LearnerMaterialsSection({
  supabase,
  userId,
  maxUploadBytes,
  actionError,
}: {
  supabase: Awaited<ReturnType<typeof requireAuthenticatedUser>>["supabase"];
  userId: string;
  maxUploadBytes: number;
  actionError?: string;
}) {
  const [uploadsEnabled, analysisEnabled, documentResult] = await Promise.all([
    isFeatureEnabled(supabase, "learning_material_uploads"),
    isFeatureEnabled(supabase, "ai_document_analysis"),
    supabase
      .from("learning_documents")
      .select(
        "id,original_filename,file_type,byte_size,status,extraction_status,analysis_status,error_message,analysis,created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);
  const documents = (documentResult.data ?? []).map((document) => ({
    ...document,
    analysis:
      typeof document.analysis === "object" && document.analysis !== null
        ? document.analysis as { title?: string }
        : null,
  }));

  return (
    <LearningMaterials
      documents={documents}
      uploadEnabled={uploadsEnabled && analysisEnabled}
      maxUploadBytes={maxUploadBytes}
      loadError={Boolean(documentResult.error)}
      actionError={actionError}
    />
  );
}
