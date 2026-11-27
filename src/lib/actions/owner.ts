"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export async function setFeatureFlagAction(formData: FormData) {
  const { supabase } = await requireRole(["platform_owner"]);
  const key = String(formData.get("key") ?? "");
  const enabled = formData.get("enabled") === "true";
  if (!key || key.length > 100) redirect("/owner/features?error=invalid");
  const { error } = await supabase.rpc("owner_set_feature_flag", {
    p_key: key,
    p_enabled: enabled,
  });
  if (error) redirect("/owner/features?error=denied");
  revalidatePath("/owner/features");
  redirect("/owner/features?saved=1");
}

export async function setAccountStatusAction(formData: FormData) {
  const { supabase, user } = await requireRole([
    "platform_owner",
    "platform_administrator",
  ]);
  const target = String(formData.get("target") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!target || !["active", "disabled", "pending_verification"].includes(status)) {
    redirect("/owner/users?error=invalid");
  }
  if (target === user.id) {
    redirect("/owner/users?error=self_status");
  }
  const { error } = await supabase.rpc("owner_set_account_status", {
    p_target_user_id: target,
    p_status: status,
  });
  if (error) redirect("/owner/users?error=denied");

  if (status === "disabled") {
    try {
      const admin = createAdminSupabaseClient();
      const { error: banError } = await admin.auth.admin.updateUserById(target, {
        ban_duration: "876000h",
      });
      if (banError) {
        logger.warn("Supabase account ban could not be applied", {
          targetUserId: target,
        });
      }
    } catch {
      logger.warn("Supabase admin configuration unavailable during suspension");
    }
  } else if (status === "active") {
    try {
      const admin = createAdminSupabaseClient();
      const { error: banError } = await admin.auth.admin.updateUserById(target, {
        ban_duration: "none",
      });
      if (banError) {
        logger.warn("Supabase account ban could not be removed", {
          targetUserId: target,
        });
      }
    } catch {
      logger.warn("Supabase admin configuration unavailable during restoration");
    }
  }
  revalidatePath("/owner/users");
  redirect("/owner/users?saved=1");
}

export async function changeRoleAction(formData: FormData) {
  const { supabase } = await requireRole(["platform_owner"]);
  const target = String(formData.get("target") ?? "");
  const role = String(formData.get("role") ?? "");
  const grant = formData.get("grant") === "true";
  const allowedRoles = [
    "learner",
    "teacher",
    "school_administrator",
    "platform_administrator",
  ];
  if (!target || !allowedRoles.includes(role)) {
    redirect("/owner/users?error=invalid");
  }
  const { error } = await supabase.rpc("owner_change_role", {
    p_target_user_id: target,
    p_role: role,
    p_grant: grant,
  });
  if (error) redirect("/owner/users?error=denied");
  revalidatePath("/owner/users");
  redirect("/owner/users?saved=1");
}
