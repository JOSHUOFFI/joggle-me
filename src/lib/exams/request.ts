import { NextResponse, type NextRequest } from "next/server";
import { getGuestWorkspace } from "@/lib/guest-workspace";

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
  const context = await getGuestWorkspace();
  const { supabase, user } = context;
  if (!user || !supabase) {
    return {
      ok: false as const,
      response: examJson(
        { message: "Start a guest workspace to continue." },
        401,
      ),
    };
  }
  return { ok: true as const, supabase, user };
}
