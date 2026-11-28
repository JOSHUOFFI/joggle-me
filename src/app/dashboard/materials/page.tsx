import { FileText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LearningMaterials } from "@/components/learning-materials";
import { requireGuestWorkspace } from "@/lib/guest-workspace";
import { isFeatureEnabled } from "@/lib/features";
import { getMaxUploadBytes } from "@/lib/materials/files";

export default async function LearningMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ materials_error?: string }>;
}) {
  const { supabase, user } = await requireGuestWorkspace();
  const [workspaceResult, uploadsEnabled, analysisEnabled, documentResult, params] = await Promise.all([
    supabase.from("guest_workspaces").select("display_name").eq("id", user.id).maybeSingle(),
    isFeatureEnabled(supabase, "learning_material_uploads"),
    isFeatureEnabled(supabase, "ai_document_analysis"),
    supabase
      .from("learning_documents")
      .select("id,original_filename,file_type,byte_size,status,extraction_status,analysis_status,error_message,analysis,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    searchParams,
  ]);
  const name = workspaceResult.data?.display_name ?? "Learner";
  const documents = (documentResult.data ?? []).map((document) => ({
    ...document,
    analysis: typeof document.analysis === "object" && document.analysis !== null
      ? document.analysis as { title?: string }
      : null,
  }));

  return (
    <AppShell learnerName={name}>
      <div className="dashboard-home">
        <div className="mb-5 flex items-start gap-3">
          <span className="dashboard-stat-icon"><FileText size={20} aria-hidden="true" /></span>
          <div>
            <p className="dashboard-kicker">YOUR STUDY LIBRARY</p>
            <h1 className="dashboard-heading mt-1 text-2xl font-bold sm:text-3xl">Learning Materials</h1>
            <p className="dashboard-muted mt-2 max-w-2xl text-sm leading-6">Upload your study documents, review analysis status, and turn ready materials into practice quizzes.</p>
          </div>
        </div>
        <LearningMaterials
          documents={documents}
          uploadEnabled={uploadsEnabled && analysisEnabled}
          maxUploadBytes={getMaxUploadBytes()}
          loadError={Boolean(documentResult.error)}
          actionError={params.materials_error}
        />
      </div>
    </AppShell>
  );
}
