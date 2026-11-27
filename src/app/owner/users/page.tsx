import { requireRole } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setAccountStatusAction, changeRoleAction } from "@/lib/actions/owner";

export default async function OwnerUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; saved?: string; error?: string }>;
}) {
  const { supabase } = await requireRole([
    "platform_owner",
    "platform_administrator",
  ]);
  const params = await searchParams;
  let query = supabase
    .from("profiles")
    .select("id,first_name,last_name,username,email,learner_category,institution,account_status,created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (params.q) query = query.or(`username.ilike.%${params.q}%,email.ilike.%${params.q}%,first_name.ilike.%${params.q}%,last_name.ilike.%${params.q}%`);
  const { data: users } = await query;

  return (
    <>
      <div className="mb-6"><p className="text-sm font-bold text-[#7655D9]">Administration</p><h1 className="mt-1 text-3xl font-black">Users</h1></div>
      {params.saved && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Administrative change saved.</p>}
      {params.error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">The change was not authorised or could not be saved.</p>}
      <Card className="overflow-hidden">
        <div className="border-b border-[#ECEAF5] p-4">
          <form method="get" className="flex max-w-md gap-2"><input name="q" defaultValue={params.q ?? ""} placeholder="Search users" className="h-11 min-w-0 flex-1 rounded-xl border border-[#DDD8EF] px-3 text-sm" /><Button type="submit" variant="secondary">Search</Button></form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#F7F7FC] text-[#77758A]"><tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Registered</th><th className="px-5 py-3">Actions</th></tr></thead>
            <tbody>{users?.length ? users.map((user) => (
              <tr key={user.id} className="border-t border-[#ECEAF5]">
                <td className="px-5 py-4"><strong>{user.first_name || user.username || "Unnamed"} {user.last_name}</strong><div className="text-[#77758A]">{user.email ?? "Email unavailable"}</div></td>
                <td className="px-5 py-4">{user.learner_category?.replaceAll("_", " ")}</td>
                <td className="px-5 py-4">{user.account_status}</td>
                <td className="px-5 py-4">{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <form action={setAccountStatusAction}><input type="hidden" name="target" value={user.id} /><input type="hidden" name="status" value={user.account_status === "disabled" ? "active" : "disabled"} /><Button type="submit" variant="secondary" size="sm">{user.account_status === "disabled" ? "Enable" : "Disable"}</Button></form>
                    <form action={changeRoleAction}><input type="hidden" name="target" value={user.id} /><input type="hidden" name="role" value="teacher" /><input type="hidden" name="grant" value="true" /><Button type="submit" variant="ghost" size="sm">Make teacher</Button></form>
                  </div>
                </td>
              </tr>
            )) : <tr><td colSpan={5} className="px-5 py-10 text-center text-[#77758A]">No users match this view.</td></tr>}</tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
