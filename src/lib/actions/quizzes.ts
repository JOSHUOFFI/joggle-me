"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function deleteQuizAction(formData: FormData) {
  const quizId = z.uuid().safeParse(formData.get("quizId"));
  if (!quizId.success) redirect("/dashboard/quizzes?error=delete");

  const { supabase } = await requireRole(["learner"]);
  const { data: deleted, error } = await supabase
    .from("learning_quizzes")
    .delete()
    .eq("id", quizId.data)
    .select("id")
    .maybeSingle();
  if (error || !deleted) {
    logger.warn("Quiz deletion was rejected", {
      quizId: quizId.data,
      code: error?.code ?? null,
    });
    redirect("/dashboard/quizzes?error=delete");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/quizzes");
  revalidatePath(`/dashboard/quizzes/${quizId.data}`);
  redirect("/dashboard/quizzes?deleted=1");
}
