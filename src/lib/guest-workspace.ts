import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const GUEST_WORKSPACE_COOKIE = "joggle_workspace";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type GuestWorkspace = {
  id: string;
  guestTokenHash: string;
};

export type GuestWorkspaceContext = {
  supabase: ReturnType<typeof createAdminSupabaseClient>;
  user: GuestWorkspace;
  isGuest: true;
  guestError: null;
};

export type MissingGuestWorkspaceContext = {
  supabase: null;
  user: null;
  isGuest: false;
  guestError: unknown | null;
};

export async function getGuestWorkspace(): Promise<
  GuestWorkspaceContext | MissingGuestWorkspaceContext
> {
  const token = (await cookies()).get(GUEST_WORKSPACE_COOKIE)?.value;
  if (!token || !TOKEN_PATTERN.test(token)) {
    return { supabase: null, user: null, isGuest: false, guestError: null };
  }

  try {
    const supabase = createAdminSupabaseClient();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data: workspaceId, error } = await supabase.rpc(
      "resolve_guest_workspace",
      { p_token_hash: tokenHash },
    );
    if (error || typeof workspaceId !== "string") {
      logger.error("Guest workspace lookup failed", { code: error?.code ?? null });
      return { supabase: null, user: null, isGuest: false, guestError: error };
    }
    return {
      supabase,
      user: { id: workspaceId, guestTokenHash: tokenHash },
      isGuest: true,
      guestError: null,
    };
  } catch (error) {
    logger.error("Guest workspace service is unavailable");
    return { supabase: null, user: null, isGuest: false, guestError: error };
  }
}

export async function requireGuestWorkspace() {
  const context = await getGuestWorkspace();
  if (!context.isGuest || !context.supabase || !context.user) {
    redirect("/workspace/start?next=%2Fdashboard");
  }
  return { supabase: context.supabase, user: context.user };
}
