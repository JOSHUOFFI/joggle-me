import { z } from "zod";

const sourceReferences = z.array(z.string().regex(/^S\d{3}$/)).min(1).max(12);

export const documentAnalysisSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(4_000),
  topics: z.array(
    z.object({
      name: z.string().trim().min(1).max(200),
      subtopics: z.array(z.string().trim().min(1).max(200)).max(20),
      sourceRefs: sourceReferences,
    }),
  ).min(1).max(30),
  keyConcepts: z.array(
    z.object({
      name: z.string().trim().min(1).max(200),
      explanation: z.string().trim().min(1).max(1_000),
      sourceRefs: sourceReferences,
    }),
  ).max(40),
  definitions: z.array(
    z.object({
      term: z.string().trim().min(1).max(200),
      definition: z.string().trim().min(1).max(1_000),
      sourceRefs: sourceReferences,
    }),
  ).max(40),
  importantFacts: z.array(
    z.object({
      fact: z.string().trim().min(1).max(1_000),
      explanation: z.string().trim().max(1_000),
      sourceRefs: sourceReferences,
    }),
  ).max(40),
});

export type DocumentAnalysis = z.infer<typeof documentAnalysisSchema>;

export type ExtractedSection = {
  sourceId: string;
  position: number;
  title: string;
  text: string;
  pageOrLocation: string;
};

export type SupportedDocumentType = "pdf" | "docx" | "txt";

export type DocumentFailureCode =
  | "invalid_document"
  | "empty_document"
  | "password_protected"
  | "document_too_large"
  | "too_many_pages"
  | "analysis_not_configured"
  | "analysis_rate_limited"
  | "analysis_unavailable"
  | "analysis_timeout"
  | "analysis_incomplete"
  | "analysis_failed"
  | "storage_failed"
  | "processing_failed";

export class DocumentProcessingError extends Error {
  constructor(
    readonly code: DocumentFailureCode,
    message: string,
    readonly stage: "extraction" | "analysis" = "extraction",
  ) {
    super(message);
    this.name = "DocumentProcessingError";
  }
}
