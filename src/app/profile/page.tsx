import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { requireGuestWorkspace } from "@/lib/guest-workspace";
import { updateWorkspaceAction } from "@/lib/actions/profile";

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { supabase, user } = await requireGuestWorkspace();
  const [{ data: workspace }, params] = await Promise.all([
    supabase.from("guest_workspaces")
      .select("display_name,created_at,expires_at")
      .eq("id", user.id)
      .maybeSingle(),
    searchParams,
  ]);

  return (
    <AppShell>
      <div className="mb-6"><p className="text-sm font-bold text-[#7655D9]">Guest workspace</p><h1 className="mt-1 text-3xl font-black">Workspace settings</h1></div>
      {params.saved && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Workspace settings updated.</p>}
      {params.error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">The update could not be saved. Please check the display name.</p>}
      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <Card className="p-5 sm:p-7">
          <h2 className="text-xl font-bold">Display name</h2>
          <p className="mt-1 text-sm text-[#77758A]">This name appears in your learning workspace. You can use JOGGLE ME without an account.</p>
          <form action={updateWorkspaceAction} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="displayName">Display name</Label><Input id="displayName" name="displayName" defaultValue={workspace?.display_name ?? "Learner"} maxLength={40} required /></div>
            <div className="sm:col-span-2"><Button type="submit">Save settings</Button></div>
          </form>
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold">Workspace retention</h2>
          <p className="mt-2 text-sm text-[#77758A]">This guest workspace and its learning data expire after 90 days without activity.</p>
          <dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-[#77758A]">Created</dt><dd>{workspace?.created_at ? new Date(workspace.created_at).toLocaleDateString() : "Unavailable"}</dd></div><div className="flex justify-between gap-4"><dt className="text-[#77758A]">Expires</dt><dd>{workspace?.expires_at ? new Date(workspace.expires_at).toLocaleDateString() : "Unavailable"}</dd></div></dl>
          <a href="/workspace/start?new=1&amp;next=%2Fdashboard" className="mt-6 inline-flex rounded-lg border border-[#DDD8EF] px-4 py-2 text-sm font-semibold text-[#35216B]">Start a new workspace</a>
        </Card>
      </div>
    </AppShell>
  );
}
