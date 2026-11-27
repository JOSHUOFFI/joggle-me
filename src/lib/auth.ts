import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AppRole =
  | "learner"
  | "teacher"
  | "school_administrator"
  | "platform_administrator"
  | "platform_owner";

const appRoles: AppRole[] = [
  "learner",
  "teacher",
  "school_administrator",
  "platform_administrator",
  "platform_owner",
];

function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && appRoles.some((role) => role === value);
}

export function parseAppRoles(data: unknown): AppRole[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item: unknown) => {
    if (typeof item !== "object" || item === null || !("role" in item)) {
      return [];
    }

    return isAppRole(item.role) ? [item.role] : [];
  });
}

export async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function requireAuthenticatedUser() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const { data: active, error } = await supabase.rpc(
    "is_account_active",
    { p_user_id: user.id },
  );
  if (error || active !== true) redirect("/forbidden");

  return { supabase, user };
}

export async function requireRole(
  roles: AppRole[],
) {
  const { supabase, user } = await requireAuthenticatedUser();
  const { data, error } = await supabase.rpc("get_my_roles");

  if (error) redirect("/forbidden");
  const activeRoles = parseAppRoles(data);
  if (!roles.some((role) => activeRoles.includes(role))) {
    redirect("/forbidden");
  }

  return { supabase, user, roles: activeRoles };
}
