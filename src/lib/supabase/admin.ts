import "server-only";
import { PostgrestClient } from "@supabase/postgrest-js";
import { StorageClient } from "@supabase/storage-js";
import { getServerEnv } from "@/lib/env";
import type { DatabaseClient } from "@/lib/supabase/types";

export function createAdminSupabaseClient(): DatabaseClient {
  const env = getServerEnv();
  if (
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error("Supabase administrative configuration is unavailable.");
  }

  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
  const database = new PostgrestClient(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`, {
    headers,
    schema: "public",
  });
  return Object.assign(database, {
    storage: new StorageClient(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1`, headers),
  });
}
