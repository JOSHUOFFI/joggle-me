"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireGuestWorkspace } from "@/lib/guest-workspace";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isFeatureEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import { processLearningDocument } from "@/lib/materials/process";
import { STORAGE_BUCKET } from "@/lib/materials/files";
import { z } from "zod";

const documentIdSchema = z.uuid();

export async function retryLearningDocumentAction(formData: FormData) {
  const documentId = documentIdSchema.safeParse(formData.get("documentId"));
  if (!documentId.success) redirect("/dashboard/materials?materials_error=invalid");

  const { supabase, user } = await requireGuestWorkspace();
  const uploadsEnabled = await isFeatureEnabled(
    supabase,
    "learning_material_uploads",
  );
  const analysisEnabled = await isFeatureEnabled(
    supabase,
    "ai_document_analysis",
  );
  if (!uploadsEnabled || !analysisEnabled) {
    redirect("/dashboard/materials?materials_error=disabled");
  }

  const { data: queued, error } = await supabase.rpc(
    "guest_retry_learning_document",
    {
      p_token_hash: user.guestTokenHash,
      p_document_id: documentId.data,
    },
  );
  if (error || queued !== true) {
    logger.warn("Learning material retry was rejected", {
      documentId: documentId.data,
      code: error?.code ?? null,
    });
    redirect("/dashboard/materials?materials_error=retry");
  }

  after(() => processLearningDocument(documentId.data, user.id));
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/materials");
  revalidatePath(`/dashboard/materials/${documentId.data}`);
  redirect("/dashboard/materials");
}

export async function deleteLearningDocumentAction(formData: FormData) {
  const documentId = documentIdSchema.safeParse(formData.get("documentId"));
  if (!documentId.success) redirect("/dashboard/materials?materials_error=invalid");

  const { supabase, user } = await requireGuestWorkspace();
  const { data: document, error: readError } = await supabase
    .from("learning_documents")
    .select("id")
    .eq("id", documentId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError || !document) {
    redirect("/dashboard/materials?materials_error=delete");
  }

  const { data: objectKey, error: beginError } = await supabase.rpc(
    "guest_begin_learning_document_delete",
    {
      p_token_hash: user.guestTokenHash,
      p_document_id: documentId.data,
    },
  );
  if (beginError || typeof objectKey !== "string") {
    redirect("/dashboard/materials?materials_error=delete");
  }

  let admin: ReturnType<typeof createAdminSupabaseClient>;
  try {
    admin = createAdminSupabaseClient();
  } catch {
    logger.error("Learning material deletion storage configuration is missing");
    const { error: cancelError } = await supabase.rpc(
      "guest_cancel_learning_document_delete",
      {
        p_token_hash: user.guestTokenHash,
        p_document_id: documentId.data,
      },
    );
    if (cancelError) {
      logger.error("Learning material deletion could not be rolled back", {
        documentId: documentId.data,
      });
    }
    redirect("/dashboard/materials?materials_error=delete");
  }

  const { error: storageError } = await admin.storage
    .from(STORAGE_BUCKET)
    .remove([objectKey]);
  if (storageError) {
    logger.error("Learning material storage deletion failed", {
      documentId: documentId.data,
      status: storageError.statusCode ?? null,
    });
    const { error: cancelError } = await supabase.rpc(
      "guest_cancel_learning_document_delete",
      {
        p_token_hash: user.guestTokenHash,
        p_document_id: documentId.data,
      },
    );
    if (cancelError) {
      logger.error("Learning material deletion could not be rolled back", {
        documentId: documentId.data,
      });
    }
      redirect("/dashboard/materials?materials_error=delete");
  }

  const { data: deleted, error: finalizeError } = await supabase.rpc(
    "guest_finalize_learning_document_delete",
    {
      p_token_hash: user.guestTokenHash,
      p_document_id: documentId.data,
    },
  );
  if (finalizeError || deleted !== true) {
    logger.error("Learning material database deletion could not be completed", {
      documentId: documentId.data,
      code: finalizeError?.code ?? null,
    });
    redirect("/dashboard/materials?materials_error=delete");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/materials");
  revalidatePath(`/dashboard/materials/${documentId.data}`);
  redirect("/dashboard/materials");
}
