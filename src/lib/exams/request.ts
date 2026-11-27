import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser, parseAppRoles } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const examJson = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

export function isSameOriginExamRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const protocol =
    forwardedProtocol || request.nextUrl.protocol.replace(/:$/, "");
  if (!origin || !host) return false;

  try {
    const originUrl = new URL(origin);
    return (
      originUrl.host === host &&
      originUrl.protocol === `${protocol}:` &&
      (originUrl.protocol === "http:" || originUrl.protocol === "https:")
    );
  } catch {
    return false;
  }
}

export async function getExamLearnerContext() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return { ok: false as const, response: examJson({ message: "Log in to continue." }, 401) };
  }

  const { data: active, error: activeError } = await supabase.rpc(
    "is_account_active",
    { p_user_id: user.id },
  );
  if (activeError) {
    logger.error("Examination account status check failed");
    return {
      ok: false as const,
      response: examJson({ message: "We couldn’t verify your account. Please retry." }, 503),
    };
  }
  if (active !== true) {
    return {
      ok: false as const,
      response: examJson({ message: "Your account cannot take examinations." }, 403),
    };
  }

  const { data: roleRows, error: roleError } = await supabase.rpc("get_my_roles");
  if (roleError) {
    logger.error("Examination role check failed");
    return {
      ok: false as const,
      response: examJson({ message: "We couldn’t verify your account role. Please retry." }, 503),
    };
  }
  if (!parseAppRoles(roleRows).includes("learner")) {
    return {
      ok: false as const,
      response: examJson({ message: "Only learner accounts can take examinations." }, 403),
    };
  }

  return { ok: true as const, supabase, user };
}
