import { Buffer } from "node:buffer";
import mammoth from "mammoth";
import * as yauzl from "yauzl";
import {
  MAX_DOCX_ENTRIES,
  MAX_DOCX_UNCOMPRESSED_BYTES,
  MAX_EXTRACTED_CHARACTERS,
  MAX_PDF_PAGES,
} from "@/lib/materials/files";
import {
  DocumentProcessingError,
  type ExtractedSection,
  type SupportedDocumentType,
} from "@/lib/materials/types";

function assertReadableSections(sections: ExtractedSection[]) {
  const nonEmpty = sections.filter((section) => section.text.trim().length > 0);
  const totalCharacters = nonEmpty.reduce(
    (total, section) => total + section.text.length,
    0,
  );
  if (totalCharacters === 0) {
    throw new DocumentProcessingError(
      "empty_document",
      "We couldn’t find readable text in this document. Scanned images and blank files aren’t supported yet.",
    );
  }
  if (totalCharacters > MAX_EXTRACTED_CHARACTERS) {
    throw new DocumentProcessingError(
      "document_too_large",
      "This document contains more text than we can safely analyse. Split it into smaller files and try again.",
    );
  }
  return nonEmpty.map((section, index) => ({
    ...section,
    position: index + 1,
  }));
}

function makeSection(
  position: number,
  title: string,
  text: string,
  pageOrLocation: string,
): ExtractedSection {
  return {
    sourceId: `S${String(position).padStart(3, "0")}`,
    position,
    title,
    text: text.trim(),
    pageOrLocation,
  };
}

async function extractPdf(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
  });

  try {
    const pdf = await loadingTask.promise;
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new DocumentProcessingError(
        "too_many_pages",
        `This PDF has more than ${MAX_PDF_PAGES} pages. Split it into smaller files and try again.`,
      );
    }

    const sections: ExtractedSection[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) {
        sections.push(
          makeSection(
            sections.length + 1,
            `Page ${pageNumber}`,
            text,
            `Page ${pageNumber}`,
          ),
        );
      }
    }
    return assertReadableSections(sections);
  } catch (error) {
    if (error instanceof DocumentProcessingError) throw error;
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "PasswordException"
    ) {
      throw new DocumentProcessingError(
        "password_protected",
        "Password-protected PDFs aren’t supported. Remove the password and upload the file again.",
      );
    }
    throw new DocumentProcessingError(
      "invalid_document",
      "This PDF is corrupted or unreadable. Check the file and upload it again.",
    );
  } finally {
    await loadingTask.destroy();
  }
}

async function validateDocxArchive(bytes: Uint8Array) {
  const archive = await yauzl.fromBufferPromise(Buffer.from(bytes), {
    lazyEntries: true,
    autoClose: false,
    validateEntrySizes: true,
    strictFileNames: true,
  });

  try {
    let entries = 0;
    let uncompressedBytes = 0;
    let hasContentTypes = false;
    let hasDocument = false;

    for await (const entry of archive.eachEntry()) {
      entries += 1;
      if (entries > MAX_DOCX_ENTRIES) {
        throw new DocumentProcessingError(
          "invalid_document",
          "This DOCX contains too many embedded parts to process safely.",
        );
      }
      if (entry.isEncrypted()) {
        throw new DocumentProcessingError(
          "password_protected",
          "Password-protected DOCX files aren’t supported. Remove the password and upload the file again.",
        );
      }
      const normalizedName = entry.fileName.replace(/\\/g, "/");
      if (
        normalizedName.startsWith("/") ||
        normalizedName.split("/").some((part) => part === "..") ||
        normalizedName.toLowerCase().includes("vbaproject.bin") ||
        normalizedName.toLowerCase().startsWith("word/embeddings/")
      ) {
        throw new DocumentProcessingError(
          "invalid_document",
          "This DOCX contains unsupported embedded content.",
        );
      }

      uncompressedBytes += entry.uncompressedSize;
      if (uncompressedBytes > MAX_DOCX_UNCOMPRESSED_BYTES) {
        throw new DocumentProcessingError(
          "invalid_document",
          "This DOCX expands to an unsafe size and can’t be processed.",
        );
      }
      if (normalizedName === "[Content_Types].xml") hasContentTypes = true;
      if (normalizedName === "word/document.xml") hasDocument = true;
    }

    if (!hasContentTypes || !hasDocument) {
      throw new DocumentProcessingError(
        "invalid_document",
        "This DOCX file is corrupted or unreadable.",
      );
    }
  } finally {
    archive.close();
  }
}

function decodeHtmlText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity) => {
      const namedEntities: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&apos;": "'",
        "&nbsp;": " ",
      };
      const normalized = entity.toLowerCase();
      if (namedEntities[normalized]) return namedEntities[normalized];
      const hexadecimal = normalized.startsWith("&#x");
      const number = Number.parseInt(
        normalized.slice(hexadecimal ? 3 : 2, -1),
        hexadecimal ? 16 : 10,
      );
      return Number.isSafeInteger(number) && number >= 0 && number <= 0x10ffff
        ? String.fromCodePoint(number)
        : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

async function extractDocx(bytes: Uint8Array) {
  try {
    await validateDocxArchive(bytes);
    const converted = await mammoth.convertToHtml({
      buffer: Buffer.from(bytes),
    });
    const blocks = Array.from(
      converted.value.matchAll(/<(h[1-6]|p)\b[^>]*>([\s\S]*?)<\/\1>/gi),
    ).map((match) => ({
      isHeading: /^h[1-6]$/i.test(match[1]),
      text: decodeHtmlText(match[2]),
    })).filter((block) => block.text);

    const sections: ExtractedSection[] = [];
    let currentTitle = "Document";
    let currentParagraphs: string[] = [];
    const flush = () => {
      if (!currentParagraphs.length) return;
      const position = sections.length + 1;
      sections.push(
        makeSection(
          position,
          currentTitle || `Section ${position}`,
          currentParagraphs.join("\n\n"),
          currentTitle || `Section ${position}`,
        ),
      );
      currentParagraphs = [];
    };

    for (const block of blocks) {
      if (block.isHeading) {
        flush();
        currentTitle = block.text;
      } else {
        currentParagraphs.push(block.text);
      }
    }
    flush();
    return assertReadableSections(sections);
  } catch (error) {
    if (error instanceof DocumentProcessingError) throw error;
    throw new DocumentProcessingError(
      "invalid_document",
      "This DOCX is corrupted or unreadable. Check the file and upload it again.",
    );
  }
}

function extractText(bytes: Uint8Array) {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new DocumentProcessingError(
      "invalid_document",
      "This TXT file must contain readable UTF-8 text.",
    );
  }
  if (text.includes("\0")) {
    throw new DocumentProcessingError(
      "invalid_document",
      "This TXT file contains binary data and can’t be read.",
    );
  }

  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const sections = paragraphs.map((paragraph, index) =>
    makeSection(
      index + 1,
      `Section ${index + 1}`,
      paragraph,
      `Paragraph ${index + 1}`,
    ),
  );
  return assertReadableSections(sections);
}

export async function extractDocumentText(
  fileType: SupportedDocumentType,
  bytes: Uint8Array,
) {
  if (fileType === "pdf") return extractPdf(bytes);
  if (fileType === "docx") return extractDocx(bytes);
  return extractText(bytes);
}
