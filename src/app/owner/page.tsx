import { requireRole } from "@/lib/auth";
import { Card } from "@/components/ui/card";

export default async function OwnerDashboardPage() {
  const { supabase } = await requireRole([
    "platform_owner",
    "platform_administrator",
  ]);
  const [
    { count: totalUsers },
    { count: activeUsers },
    { data: categories },
    { count: enabledFeatures },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("account_status", "active").is("deleted_at", null),
    supabase.from("profiles").select("learner_category"),
    supabase.from("feature_flags").select("key", { count: "exact", head: true }).eq("enabled", true),
  ]);

  const breakdown: Record<string, number> = {};
  for (const item of categories ?? []) {
    const category = item.learner_category ?? "unknown";
    breakdown[category] = (breakdown[category] ?? 0) + 1;
  }

  return (
    <>
      <div className="mb-6"><p className="text-sm font-bold text-[#7655D9]">JoLight Technologies</p><h1 className="mt-1 text-3xl font-black">Platform overview</h1></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5"><p className="text-sm text-[#77758A]">Registered users</p><p className="mt-2 text-3xl font-black">{totalUsers ?? 0}</p></Card>
        <Card className="p-5"><p className="text-sm text-[#77758A]">Active users</p><p className="mt-2 text-3xl font-black">{activeUsers ?? 0}</p></Card>
        <Card className="p-5"><p className="text-sm text-[#77758A]">Enabled features</p><p className="mt-2 text-3xl font-black">{enabledFeatures ?? 0}</p></Card>
        <Card className="p-5"><p className="text-sm text-[#77758A]">Platform status</p><p className="mt-2 text-xl font-black text-emerald-700">Operational</p></Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6"><h2 className="text-lg font-bold">Learner categories</h2><div className="mt-4 space-y-3">{Object.entries(breakdown).length ? Object.entries(breakdown).map(([key, value]) => <div key={key} className="flex justify-between border-b border-[#ECEAF5] pb-3 text-sm"><span className="text-[#77758A]">{key.replaceAll("_", " ")}</span><strong>{value}</strong></div>) : <p className="text-sm text-[#77758A]">No registered learner profiles.</p>}</div></Card>
        <Card className="p-6"><h2 className="text-lg font-bold">Platform activity</h2><p className="mt-3 text-sm text-[#77758A]">Detailed activity records will appear as operational features are enabled. No fabricated activity is displayed.</p></Card>
      </div>
    </>
  );
}
