import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/materials/files";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || !supplied) return false;
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length
    && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const supabase = createAdminSupabaseClient();
  const expiredBefore = new Date().toISOString();
  const { data: workspaces, error: workspaceError } = await supabase
    .from("guest_workspaces")
    .select("id")
    .lt("expires_at", expiredBefore)
    .order("expires_at", { ascending: true })
    .limit(100);

  if (workspaceError) {
    return NextResponse.json({ message: "Retention cleanup is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  let deleted = 0;
  let failed = 0;
  for (const workspace of workspaces ?? []) {
    const { data: documents, error: documentsError } = await supabase
      .from("learning_documents")
      .select("object_key")
      .eq("user_id", workspace.id);
    if (documentsError) {
      failed += 1;
      continue;
    }

    const objectKeys = [...new Set((documents ?? []).map((document) => document.object_key))];
    if (objectKeys.some((key) => !key.startsWith(`${workspace.id}/`))) {
      failed += 1;
      continue;
    }

    let storageFailed = false;
    for (let offset = 0; offset < objectKeys.length; offset += 100) {
      const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(objectKeys.slice(offset, offset + 100));
      if (error) {
        storageFailed = true;
        break;
      }
    }
    if (storageFailed) {
      failed += 1;
      continue;
    }

    const { data: removed, error: deleteError } = await supabase
      .from("guest_workspaces")
      .delete()
      .eq("id", workspace.id)
      .lt("expires_at", expiredBefore)
      .select("id");
    if (deleteError) {
      failed += 1;
      continue;
    }
    if (removed?.length) deleted += 1;
  }

  return NextResponse.json({ examined: workspaces?.length ?? 0, deleted, failed }, {
    headers: { "Cache-Control": "no-store" },
  });
}
