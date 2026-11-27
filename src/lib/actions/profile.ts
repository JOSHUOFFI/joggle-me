"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth";
import { profileSchema } from "@/lib/validation/auth";
import { z } from "zod";

export async function updateProfileAction(formData: FormData) {
  const { supabase, user } = await requireAuthenticatedUser();
  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    username: formData.get("username"),
    phoneNumber: formData.get("phoneNumber") || undefined,
    profileImageUrl: formData.get("profileImageUrl") || undefined,
    learnerCategory: formData.get("learnerCategory"),
    institution: formData.get("institution") || undefined,
  });
  if (!parsed.success) redirect("/profile?error=validation");

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      username: parsed.data.username,
      phone_number: parsed.data.phoneNumber ?? null,
      profile_image_url: parsed.data.profileImageUrl || null,
      learner_category: parsed.data.learnerCategory,
      institution: parsed.data.institution || null,
    })
    .eq("id", user.id);

  if (error) redirect("/profile?error=update");
  revalidatePath("/profile");
  redirect("/profile?saved=1");
}

export async function requestEmailChangeAction(formData: FormData) {
  const { supabase } = await requireAuthenticatedUser();
  const email = String(formData.get("email") ?? "").trim();
  const emailResult = z.email().safeParse(email);
  if (!emailResult.success) redirect("/profile?error=email");
  const { error } = await supabase.auth.updateUser({ email });
  if (error) redirect("/profile?error=email");
  redirect("/profile?email_verification=1");
}
