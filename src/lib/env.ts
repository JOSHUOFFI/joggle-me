import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  INITIAL_OWNER_USER_ID: z.uuid().optional(),
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

export function getPublicEnv() {
  const env = publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  return {
    ...env,
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL
      ? normalizeSupabaseProjectUrl(env.NEXT_PUBLIC_SUPABASE_URL)
      : undefined,
  };
}

export function getServerEnv() {
  const publicEnv = getPublicEnv();
  const serverEnv = serverEnvSchema
    .pick({
      SUPABASE_SERVICE_ROLE_KEY: true,
      INITIAL_OWNER_USER_ID: true,
    })
    .parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    INITIAL_OWNER_USER_ID: process.env.INITIAL_OWNER_USER_ID,
  });

  return { ...publicEnv, ...serverEnv };
}

export function isSupabaseConfigured() {
  const env = getPublicEnv();
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
