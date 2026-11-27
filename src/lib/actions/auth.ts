"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loginSchema, passwordResetSchema, registrationSchema, resetRequestSchema } from "@/lib/validation/auth";
import { isFeatureEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import {
  getPasswordRecoveryUser,
  PASSWORD_RECOVERY_COOKIE,
} from "@/lib/auth/recovery";

export async function registerAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!(await isFeatureEnabled(supabase, "user_registration"))) {
    redirect("/register?error=registration_disabled");
  }

  const parsed = registrationSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) redirect("/register?error=validation");

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { first_name: parsed.data.firstName, last_name: parsed.data.lastName, username: parsed.data.username },
    },
  });
  if (error) redirect(error.message.toLowerCase().includes("already") ? "/register?error=exists" : "/register?error=auth");

  if (data.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      username: parsed.data.username,
      email: parsed.data.email,
      learner_category: "independent",
    });
  }
  revalidatePath("/", "layout");
  redirect("/verify-email");
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) redirect("/login?error=validation");
  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  let signInError: { status?: number } | null = null;
  try {
    supabase = await createServerSupabaseClient();
    const result = await supabase.auth.signInWithPassword(parsed.data);
    signInError = result.error;
  } catch {
    redirect("/login?error=network");
  }
  if (signInError) {
    const status = signInError.status;
    redirect(status === undefined || status === 0 || status >= 500
      ? "/login?error=network"
      : "/login?error=credentials");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=credentials");

  const { data: active, error: statusError } = await supabase.rpc(
    "is_account_active",
    { p_user_id: user.id },
  );
  if (statusError || active !== true) {
    await supabase.auth.signOut();
    redirect("/login?error=suspended");
  }
  redirect("/dashboard");
}

export async function resetRequestAction(formData: FormData) {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) redirect("/reset-password?error=validation");
  const supabase = await createServerSupabaseClient();
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/auth/callback?next=/update-password`,
    });
    if (error) {
      logger.error("Password recovery request failed", {
        status: error.status ?? null,
      });
    }
  } catch (error) {
    logger.error("Password recovery request failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
  }
  redirect("/reset-password?sent=1");
}

export async function passwordResetAction(formData: FormData) {
  const parsed = passwordResetSchema.safeParse({ password: formData.get("password"), confirmPassword: formData.get("confirmPassword") });
  if (!parsed.success) redirect("/update-password?error=validation");
  const supabase = await createServerSupabaseClient();
  const cookieStore = await cookies();
  const recoveryMarker = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value;
  const recoveryUser = await getPasswordRecoveryUser(supabase, recoveryMarker);
  if (!recoveryUser) {
    cookieStore.delete(PASSWORD_RECOVERY_COOKIE);
    redirect("/update-password?error=link");
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logger.error("Password recovery update failed", {
      status: error.status ?? null,
    });
    redirect("/update-password?error=update");
  }

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    logger.error("Password recovery session sign-out failed", {
      status: signOutError.status ?? null,
    });
  }
  cookieStore.delete(PASSWORD_RECOVERY_COOKIE);
  revalidatePath("/", "layout");
  redirect("/login?password_reset=success");
}
