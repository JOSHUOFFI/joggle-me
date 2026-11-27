import { requireRole } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setFeatureFlagAction } from "@/lib/actions/owner";

export default async function OwnerFeaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { supabase } = await requireRole(["platform_owner"]);
  const { data: flags } = await supabase
    .from("feature_flags")
    .select("key,name,description,enabled,updated_at")
    .order("name");
  const params = await searchParams;

  return (
    <>
      <div className="mb-6"><p className="text-sm font-bold text-[#7655D9]">Platform controls</p><h1 className="mt-1 text-3xl font-black">Feature availability</h1></div>
      {params.saved && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Feature availability saved.</p>}
      {params.error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Only the platform owner can change feature availability.</p>}
      <div className="grid gap-4">{flags?.length ? flags.map((flag) => (
        <Card key={flag.key} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-bold">{flag.name}</h2><p className="mt-1 max-w-2xl text-sm text-[#77758A]">{flag.description}</p></div>
          <form action={setFeatureFlagAction} className="shrink-0">
            <input type="hidden" name="key" value={flag.key} />
            <input type="hidden" name="enabled" value={flag.enabled ? "false" : "true"} />
            <Button type="submit" variant={flag.enabled ? "danger" : "primary"}>{flag.enabled ? "Disable" : "Enable"}</Button>
          </form>
        </Card>
      )) : <Card className="p-8 text-center text-sm text-[#77758A]">Feature flags are not available. Apply the Phase 1 migration.</Card>}</div>
    </>
  );
}
