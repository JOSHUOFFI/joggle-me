import { createHash, randomUUID } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getGuestWorkspace } from "@/lib/guest-workspace";
import { isFeatureEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import {
  getMaxUploadBytes,
  getSafeFileName,
  STORAGE_BUCKET,
  UploadValidationError,
  validateDocumentBytes,
} from "@/lib/materials/files";
import { processLearningDocument } from "@/lib/materials/process";

export const runtime = "nodejs";
export const maxDuration = 120;

const json = (body: object, status: number) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

async function readLimitedBody(request: Request, limit: number) {
  if (!request.body) {
    throw new UploadValidationError("invalid_file", "Choose a file to upload.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new UploadValidationError(
          "too_large",
          `The file exceeds the ${Math.floor(limit / (1024 * 1024))} MB size limit.`,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  let originMatches = false;
  try {
    const requestHost = request.headers.get("host");
    const forwardedProtocol = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      .trim();
    const requestProtocol =
      forwardedProtocol || request.nextUrl.protocol.replace(/:$/, "");
    const originUrl = origin ? new URL(origin) : null;
    originMatches = Boolean(
      originUrl &&
        requestHost &&
        (originUrl.protocol === "http:" || originUrl.protocol === "https:") &&
        originUrl.host === requestHost &&
        originUrl.protocol === `${requestProtocol}:`,
    );
  } catch {
    originMatches = false;
  }
  if (!originMatches) {
    return json({ message: "The upload request origin could not be verified." }, 403);
  }

  const context = await getGuestWorkspace();
  const { supabase, user } = context;
  if (!user || !supabase) {
    return json(
      { message: "Start a guest workspace to upload learning materials." },
      401,
    );
  }

  if (
    !(await isFeatureEnabled(supabase, "learning_material_uploads")) ||
    !(await isFeatureEnabled(supabase, "ai_document_analysis"))
  ) {
    return json(
      { message: "Learning material uploads and analysis are currently unavailable." },
      503,
    );
  }

  let maxUploadBytes: number;
  let fileName: string;
  let bytes: Uint8Array;
  let file: ReturnType<typeof validateDocumentBytes>;
  try {
    maxUploadBytes = getMaxUploadBytes();
  } catch {
    logger.error("Learning material upload size configuration is invalid");
    return json({ message: "Secure upload limits are not configured correctly." }, 503);
  }
  try {
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxUploadBytes) {
      throw new UploadValidationError(
        "too_large",
        `The file exceeds the ${Math.floor(maxUploadBytes / (1024 * 1024))} MB size limit.`,
      );
    }
    fileName = getSafeFileName(request.headers.get("x-file-name"));
    bytes = await readLimitedBody(request, maxUploadBytes);
    file = validateDocumentBytes(
      fileName,
      request.headers.get("content-type"),
      bytes,
    );
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return json(
        { message: error.message },
        error.code === "too_large" ? 413 : 400,
      );
    }
    logger.error("Learning material upload could not be validated");
    return json({ message: "We couldn’t read this upload. Please try again." }, 400);
  }

  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const { data: existing, error: duplicateCheckError } = await supabase
    .from("learning_documents")
    .select("id")
    .eq("user_id", user.id)
    .eq("content_hash", contentHash)
    .maybeSingle();
  if (duplicateCheckError) {
    logger.error("Learning material duplicate check failed");
    return json({ message: "We couldn’t check for duplicate files. Please try again." }, 503);
  }
  if (existing) {
    return json(
      {
        message: "This document is already in your library.",
        documentId: existing.id,
      },
      409,
    );
  }

  const documentId = randomUUID();
  const objectKey = `${user.id}/${documentId}${file.extension}`;
  let admin: ReturnType<typeof createAdminSupabaseClient>;
  try {
    admin = createAdminSupabaseClient();
  } catch {
    logger.error("Learning material storage is not configured");
    return json({ message: "Secure file storage is not configured yet." }, 503);
  }

  const fileBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(fileBuffer).set(bytes);
  const { error: storageError } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(objectKey, new Blob([fileBuffer], { type: file.mimeType }), {
      contentType: file.mimeType,
      upsert: false,
    });
  if (storageError) {
    const { error: cleanupError } = await admin.storage
      .from(STORAGE_BUCKET)
      .remove([objectKey]);
    if (cleanupError) {
      logger.error("Incomplete learning material upload cleanup failed", {
        documentId,
        status: cleanupError.statusCode ?? null,
      });
    }
    logger.error("Learning material storage upload failed", {
      status: storageError.statusCode ?? null,
    });
    return json(
      { message: "We couldn’t store this file securely. Please try again." },
      503,
    );
  }

  const { data: createdId, error: createError } = await supabase.rpc(
    "guest_create_learning_document",
    {
      p_token_hash: user.guestTokenHash,
      p_document_id: documentId,
      p_original_filename: fileName,
      p_file_type: file.fileType,
      p_mime_type: file.mimeType,
      p_byte_size: bytes.byteLength,
      p_content_hash: contentHash,
    },
  );
  if (createError || createdId !== documentId) {
    const { error: cleanupError } = await admin.storage
      .from(STORAGE_BUCKET)
      .remove([objectKey]);
    if (cleanupError) {
      logger.error("Orphan learning material object cleanup failed", {
        documentId,
        status: cleanupError.statusCode ?? null,
      });
    }

    if (createError?.code === "23505") {
      const { data: duplicate } = await supabase
        .from("learning_documents")
        .select("id")
        .eq("user_id", user.id)
        .eq("content_hash", contentHash)
        .maybeSingle();
      if (duplicate) {
        return json(
          {
            message: "This document is already in your library.",
            documentId: duplicate.id,
          },
          409,
        );
      }
    }
    logger.error("Learning material record creation failed", {
      documentId,
      code: createError?.code ?? null,
    });
    return json(
      { message: "We couldn’t add this document to your library. Please try again." },
      503,
    );
  }

  after(() => processLearningDocument(documentId, user.id));
  return json({ documentId, status: "queued" }, 201);
}
