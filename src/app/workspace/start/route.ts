import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { GUEST_WORKSPACE_COOKIE } from "@/lib/guest-workspace";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

function safeDestination(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  return value;
}

export async function GET(request: NextRequest) {
  const next = safeDestination(request.nextUrl.searchParams.get("next"));
  const forceNew = request.nextUrl.searchParams.get("new") === "1";
  const currentToken = request.cookies.get(GUEST_WORKSPACE_COOKIE)?.value;

  if (!forceNew && currentToken && tokenPattern.test(currentToken)) {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase.rpc("resolve_guest_workspace", {
      p_token_hash: createHash("sha256").update(currentToken).digest("hex"),
    });
    if (!error && typeof data === "string") {
      return NextResponse.redirect(new URL(next, request.url), 303);
    }
  }

  const token = randomBytes(32).toString("base64url");
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("guest_workspaces").insert({
    token_hash: createHash("sha256").update(token).digest("hex"),
  });
  if (error) {
    return NextResponse.json(
      { message: "A learning workspace could not be started. Please try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(GUEST_WORKSPACE_COOKIE, token, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
