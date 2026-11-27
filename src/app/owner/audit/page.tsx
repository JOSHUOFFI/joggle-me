import { requireRole } from "@/lib/auth";
import { Card } from "@/components/ui/card";

export default async function OwnerAuditPage() {
  const { supabase } = await requireRole(["platform_owner"]);
  const { data: logs } = await supabase
    .from("administrative_audit_logs")
    .select("id,actor_id,action,target_type,target_id,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <div className="mb-6"><p className="text-sm font-bold text-[#7655D9]">Security history</p><h1 className="mt-1 text-3xl font-black">Administrative audit log</h1></div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[#F7F7FC] text-[#77758A]"><tr><th className="px-5 py-3">Action</th><th className="px-5 py-3">Target</th><th className="px-5 py-3">Actor</th><th className="px-5 py-3">Timestamp</th></tr></thead>
          <tbody>{logs?.length ? logs.map((log) => <tr key={log.id} className="border-t border-[#ECEAF5]"><td className="px-5 py-4 font-semibold">{log.action}</td><td className="px-5 py-4">{log.target_type}: {log.target_id ?? "—"}</td><td className="px-5 py-4">{log.actor_id}</td><td className="px-5 py-4">{new Date(log.created_at).toLocaleString()}</td></tr>) : <tr><td colSpan={4} className="px-5 py-10 text-center text-[#77758A]">No privileged administrative actions have been recorded.</td></tr>}</tbody>
        </table>
      </Card>
    </>
  );
}
