import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export function normalizeSupabaseProjectUrl(value: string) {
  const url = new URL(value);
  const path = url.pathname.replace(/\/+$/, "");

  if (path !== "" && path !== "/rest/v1") {
    throw new Error("Supabase URL must be a project URL or a REST endpoint URL.");
  }
  if (url.search || url.hash) {
    throw new Error("Supabase project URL must not contain a query or fragment.");
  }

  return url.origin;
}

export function getServerEnv() {
  const env = serverEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  return {
    ...env,
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL
      ? normalizeSupabaseProjectUrl(env.NEXT_PUBLIC_SUPABASE_URL)
      : undefined,
  };
}
