import { createHash, randomUUID } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/features";
import {
  UploadValidationError,
  STORAGE_BUCKET,
  validateDocumentBytes,
} from "@/lib/materials/files";
import { geminiDocumentAnalysisProvider } from "@/lib/materials/analysis";
import { extractDocumentText } from "@/lib/materials/extract";
import { DocumentProcessingError } from "@/lib/materials/types";

export async function processLearningDocument(
  documentId: string,
  userId: string,
) {
  const admin = createAdminSupabaseClient();
  const { data: document, error: documentError } = await admin
    .from("learning_documents")
    .select(
      "id,user_id,original_filename,file_type,mime_type,byte_size,content_hash,object_key,attempt_count",
    )
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (documentError || !document) {
    logger.error("Learning document could not be loaded for processing", {
      documentId,
    });
    return;
  }

  const processingToken = randomUUID();
  const { data: claimed, error: claimError } = await admin
    .from("learning_documents")
    .update({
      status: "processing",
      extraction_status: "processing",
      analysis_status: "queued",
      processing_token: processingToken,
      attempt_count: document.attempt_count + 1,
      error_code: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .eq("user_id", userId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();

  if (claimError) {
    logger.error("Learning document processing could not be claimed", {
      documentId,
    });
    return;
  }
  if (!claimed) return;

  let stage: "extraction" | "analysis" = "extraction";
  let extractionReady = false;

  try {
    const { data: workspace, error: workspaceError } = await admin
      .from("guest_workspaces")
      .select("id")
      .eq("id", userId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (
      workspaceError ||
      !workspace
    ) {
      throw new DocumentProcessingError(
        "processing_failed",
        "This learning workspace has expired and cannot process documents.",
      );
    }

    const { data: file, error: storageError } = await admin.storage
      .from(STORAGE_BUCKET)
      .download(document.object_key);
    if (storageError || !file) {
      throw new DocumentProcessingError(
        "storage_failed",
        "We couldn’t retrieve this file for processing. Try uploading it again.",
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (
      bytes.byteLength !== document.byte_size ||
      createHash("sha256").update(bytes).digest("hex") !==
        document.content_hash
    ) {
      throw new DocumentProcessingError(
        "invalid_document",
        "The stored file did not match the uploaded document. Delete it and upload it again.",
      );
    }
    try {
      const validatedFile = validateDocumentBytes(
        document.original_filename,
        document.mime_type,
        bytes,
      );
      if (validatedFile.fileType !== document.file_type) {
        throw new DocumentProcessingError(
          "invalid_document",
          "The stored file type did not match its document record.",
        );
      }
    } catch (error) {
      if (error instanceof UploadValidationError) {
        throw new DocumentProcessingError(
          "invalid_document",
          error.message,
        );
      }
      throw error;
    }

    const sections = await extractDocumentText(document.file_type, bytes);
    const { error: clearSectionsError } = await admin
      .from("document_sections")
      .delete()
      .eq("document_id", documentId)
      .eq("user_id", userId);
    if (clearSectionsError) {
      throw new DocumentProcessingError(
        "processing_failed",
        "We couldn’t save the extracted text. Please retry processing.",
      );
    }

    const { error: insertSectionsError } = await admin
      .from("document_sections")
      .insert(
        sections.map((section) => ({
          document_id: documentId,
          user_id: userId,
          source_id: section.sourceId,
          position: section.position,
          title: section.title,
          text: section.text,
          page_or_location: section.pageOrLocation,
        })),
      );
    if (insertSectionsError) {
      throw new DocumentProcessingError(
        "processing_failed",
        "We couldn’t save the extracted text. Please retry processing.",
      );
    }

    const { data: extractionUpdated, error: extractionUpdateError } = await admin
      .from("learning_documents")
      .update({
        extraction_status: "ready",
        analysis_status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .eq("user_id", userId)
      .eq("status", "processing")
      .eq("processing_token", processingToken)
      .select("id")
      .maybeSingle();
    if (extractionUpdateError) {
      throw new DocumentProcessingError(
        "processing_failed",
        "We couldn’t save the extracted text. Please retry processing.",
      );
    }
    if (!extractionUpdated) return;
    extractionReady = true;
    stage = "analysis";

    if (!(await isFeatureEnabled(admin, "ai_document_analysis"))) {
      throw new DocumentProcessingError(
        "analysis_unavailable",
        "AI document analysis is currently disabled. Please try again later.",
        "analysis",
      );
    }

    const analysis = await geminiDocumentAnalysisProvider.analyze(sections);
    const { data: completed, error: completionError } = await admin
      .from("learning_documents")
      .update({
        status: "ready",
        extraction_status: "ready",
        analysis_status: "ready",
        analysis,
        analysis_model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash",
        analyzed_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
        processing_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .eq("user_id", userId)
      .eq("status", "processing")
      .eq("processing_token", processingToken)
      .select("id")
      .maybeSingle();
    if (completionError) {
      throw new DocumentProcessingError(
        "processing_failed",
        "We couldn’t save the analysis. Please retry processing.",
        "analysis",
      );
    }
    if (!completed) return;
  } catch (error) {
    const failure =
      error instanceof DocumentProcessingError
        ? error
        : new DocumentProcessingError(
            "processing_failed",
            "We couldn’t process this document. Try again or upload another file.",
            stage,
          );
    logger.error("Learning document processing failed", {
      documentId,
      code: failure.code,
      stage: failure.stage,
    });

    const { error: updateError } = await admin
      .from("learning_documents")
      .update({
        status: "failed",
        extraction_status:
          failure.stage === "extraction"
            ? "failed"
            : extractionReady
              ? "ready"
              : "failed",
        analysis_status: failure.stage === "analysis" ? "failed" : "queued",
        error_code: failure.code,
        error_message: failure.message,
        analysis: null,
        analyzed_at: null,
        processing_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .eq("user_id", userId)
      .eq("status", "processing")
      .eq("processing_token", processingToken);
    if (updateError) {
      logger.error("Learning document failure state could not be saved", {
        documentId,
        code: failure.code,
      });
    }
  }
}
