import type { SupabaseClient } from "@supabase/supabase-js";

export async function isFeatureEnabled(
  supabase: SupabaseClient,
  key: string,
): Promise<boolean> {
  if (!/^[a-z][a-z0-9_]{1,99}$/.test(key)) return false;
  const { data, error } = await supabase.rpc("is_feature_enabled", {
    p_key: key,
  });
  return !error && data === true;
}
