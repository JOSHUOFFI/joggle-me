import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PASSWORD_RECOVERY_COOKIE = "joggle-me-password-recovery";

export function createPasswordRecoveryMarker(userId: string, accessToken: string) {
  const signature = createHmac("sha256", accessToken)
    .update(userId)
    .digest("hex");

  return `${userId}.${signature}`;
}

export function isPasswordRecoveryMarkerValid(
  marker: string | undefined,
  userId: string,
  accessToken: string,
) {
  if (!marker) return false;

  const separator = marker.lastIndexOf(".");
  if (separator < 1 || marker.slice(0, separator) !== userId) return false;

  const suppliedSignature = marker.slice(separator + 1);
  if (!/^[\da-f]{64}$/.test(suppliedSignature)) return false;

  const expectedSignature = createPasswordRecoveryMarker(userId, accessToken).slice(
    separator + 1,
  );
  return timingSafeEqual(
    Buffer.from(suppliedSignature, "hex"),
    Buffer.from(expectedSignature, "hex"),
  );
}

export async function getPasswordRecoveryUser(
  supabase: SupabaseClient,
  marker: string | undefined,
) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session) return null;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (
    userError ||
    !user ||
    user.id !== session.user.id ||
    !isPasswordRecoveryMarkerValid(marker, user.id, session.access_token)
  ) {
    return null;
  }

  return user;
}
