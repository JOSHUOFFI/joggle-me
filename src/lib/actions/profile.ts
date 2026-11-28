"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireGuestWorkspace } from "@/lib/guest-workspace";

const displayNameSchema = z.string().trim().min(2).max(40)
  .regex(/^[\p{L}\p{N} _.'-]+$/u);

export async function updateWorkspaceAction(formData: FormData) {
  const displayName = displayNameSchema.safeParse(formData.get("displayName"));
  if (!displayName.success) redirect("/profile?error=validation");
  const { supabase, user } = await requireGuestWorkspace();
  const { error } = await supabase
    .from("guest_workspaces")
    .update({ display_name: displayName.data })
    .eq("id", user.id);
  if (error) redirect("/profile?error=update");
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  redirect("/profile?saved=1");
}
