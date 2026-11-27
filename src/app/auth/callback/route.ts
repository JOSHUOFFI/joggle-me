import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createPasswordRecoveryMarker,
  PASSWORD_RECOVERY_COOKIE,
} from "@/lib/auth/recovery";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");
  const isRecovery = requestedNext === "/update-password";
  const next = isRecovery
    ? "/update-password"
    : requestedNext === "/verify-email"
      ? "/verify-email"
      : "/dashboard";
  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user && data.session) {
      const response = NextResponse.redirect(new URL(next, request.url));
      if (isRecovery) {
        response.cookies.set(
          PASSWORD_RECOVERY_COOKIE,
          createPasswordRecoveryMarker(data.user.id, data.session.access_token),
          {
            httpOnly: true,
            secure: request.nextUrl.protocol === "https:",
            sameSite: "lax",
            path: "/",
            maxAge: 15 * 60,
          },
        );
      } else {
        response.cookies.delete(PASSWORD_RECOVERY_COOKIE);
      }
      return response;
    }
  }

  return NextResponse.redirect(
    new URL(
      isRecovery ? "/update-password?error=link" : "/login?error=auth",
      request.url,
    ),
  );
}
