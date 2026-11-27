import { Buffer } from "node:buffer";
import type { SupportedDocumentType } from "@/lib/materials/types";
import { DocumentProcessingError } from "@/lib/materials/types";

export const STORAGE_BUCKET = "learning-materials";
export const DEFAULT_MAX_UPLOAD_MB = 20;
export const MAX_CONFIGURED_UPLOAD_MB = 50;
export const MAX_EXTRACTED_CHARACTERS = 100_000;
export const MAX_PDF_PAGES = 100;
export const MAX_DOCX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
export const MAX_DOCX_ENTRIES = 2_000;

const supportedFiles: Record<
  SupportedDocumentType,
  { extension: string; mimeType: string }
> = {
  pdf: { extension: ".pdf", mimeType: "application/pdf" },
  docx: {
    extension: ".docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  txt: { extension: ".txt", mimeType: "text/plain" },
};

export class UploadValidationError extends Error {
  constructor(
    readonly code: "unsupported_type" | "too_large" | "invalid_file",
    message: string,
  ) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export function getMaxUploadBytes() {
  const configured = process.env.DOCUMENT_MAX_FILE_SIZE_MB;
  if (configured === undefined || configured.trim() === "") {
    return DEFAULT_MAX_UPLOAD_MB * 1024 * 1024;
  }

  const megabytes = Number(configured);
  if (
    !Number.isSafeInteger(megabytes) ||
    megabytes < 1 ||
    megabytes > MAX_CONFIGURED_UPLOAD_MB
  ) {
    throw new Error(
      `DOCUMENT_MAX_FILE_SIZE_MB must be a whole number between 1 and ${MAX_CONFIGURED_UPLOAD_MB}.`,
    );
  }
  return megabytes * 1024 * 1024;
}

export function getSafeFileName(value: string | null) {
  let decoded = "";
  try {
    decoded = decodeURIComponent(value ?? "");
  } catch {
    throw new UploadValidationError("invalid_file", "The file name is invalid.");
  }

  const baseName = decoded.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  if (!baseName || baseName.length > 255) {
    throw new UploadValidationError("invalid_file", "The file name is invalid.");
  }

  const normalized = baseName
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N}_. -]/gu, "_")
    .replace(/^\.+/, "")
    .slice(0, 180)
    .trim();

  if (!normalized || normalized === "." || normalized === "..") {
    throw new UploadValidationError("invalid_file", "The file name is invalid.");
  }
  return normalized;
}

export function validateDocumentBytes(
  fileName: string,
  declaredMimeType: string | null,
  bytes: Uint8Array,
): { fileType: SupportedDocumentType; mimeType: string; extension: string } {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  const fileType = (Object.keys(supportedFiles) as SupportedDocumentType[]).find(
    (type) => supportedFiles[type].extension === extension,
  );
  if (!fileType) {
    throw new UploadValidationError(
      "unsupported_type",
      "Choose a PDF, DOCX, or TXT file.",
    );
  }

  if (bytes.byteLength === 0) {
    throw new UploadValidationError("invalid_file", "The selected file is empty.");
  }

  const expected = supportedFiles[fileType];
  const suppliedMime = declaredMimeType?.split(";")[0].trim().toLowerCase();
  if (
    suppliedMime &&
    suppliedMime !== expected.mimeType &&
    suppliedMime !== "application/octet-stream"
  ) {
    throw new UploadValidationError(
      "invalid_file",
      "The file type does not match its file name.",
    );
  }

  const buffer = Buffer.from(bytes);
  if (fileType === "pdf" && buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new UploadValidationError(
      "invalid_file",
      "This PDF file appears to be invalid or unreadable.",
    );
  }
  if (
    fileType === "docx" &&
    !(
      buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
      buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
    )
  ) {
    throw new UploadValidationError(
      "invalid_file",
      "This DOCX file is invalid or password-protected.",
    );
  }
  if (fileType === "txt") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (text.includes("\0")) throw new Error("Binary text file");
    } catch {
      throw new UploadValidationError(
        "invalid_file",
        "This TXT file must contain readable UTF-8 text.",
      );
    }
  }

  return { fileType, mimeType: expected.mimeType, extension };
}

export function processingFailureMessage(error: unknown) {
  if (error instanceof DocumentProcessingError) {
    return { code: error.code, message: error.message, stage: error.stage };
  }
  return {
    code: "processing_failed" as const,
    message: "We couldn’t process this document. Try again or upload another file.",
    stage: "extraction" as const,
  };
}
