import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getGuestWorkspace } from "@/lib/guest-workspace";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isFeatureEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import {
  documentAnalysisSchema,
  type ExtractedSection,
} from "@/lib/materials/types";
import {
  generateAndValidateQuiz,
  geminiQuizGenerationProvider,
  getQuizSections,
  getQuizTitle,
  getSelectedQuizTopics,
  QuizGenerationError,
} from "@/lib/quizzes/generation";
import { quizGenerationRequestSchema } from "@/lib/quizzes/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const json = (body: object, status: number) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const protocol =
    forwardedProtocol || request.nextUrl.protocol.replace(/:$/, "");
  if (!origin || !host) return false;
  try {
    const originUrl = new URL(origin);
    return (
      originUrl.host === host &&
      originUrl.protocol === `${protocol}:` &&
      (originUrl.protocol === "http:" || originUrl.protocol === "https:")
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return json({ message: "The quiz request origin could not be verified." }, 403);
  }

  const context = await getGuestWorkspace();
  const { supabase, user } = context;
  if (!user || !supabase) {
    return json(
      { message: "Start a guest workspace to generate a quiz." },
      401,
    );
  }

  const flags = await Promise.all([
    isFeatureEnabled(supabase, "ai_quiz_generation"),
    isFeatureEnabled(supabase, "ai_document_analysis"),
    isFeatureEnabled(supabase, "learning_material_uploads"),
  ]);
  if (flags.some((enabled) => !enabled)) {
    return json(
      { message: "Quiz generation and analysed learning materials are currently unavailable." },
      503,
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ message: "The quiz configuration could not be read." }, 400);
  }
  const parsedRequest = quizGenerationRequestSchema.safeParse(rawBody);
  if (!parsedRequest.success) {
    return json(
      { message: "Review the quiz settings and select at least one valid topic." },
      400,
    );
  }
  const generationRequest = parsedRequest.data;

  const { data: document, error: documentError } = await supabase
    .from("learning_documents")
    .select("id,original_filename,status,analysis_status,analysis")
    .eq("id", generationRequest.documentId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (documentError) {
    logger.error("Quiz source document could not be loaded", {
      userId: user.id,
      documentId: generationRequest.documentId,
    });
    return json({ message: "We couldn’t verify the selected document. Please retry." }, 503);
  }
  if (
    !document ||
    document.status !== "ready" ||
    document.analysis_status !== "ready"
  ) {
    return json(
      { message: "Choose one of your documents with a completed analysis." },
      404,
    );
  }

  const analysis = documentAnalysisSchema.safeParse(document.analysis);
  if (!analysis.success) {
    return json(
      { message: "This document’s saved analysis is incomplete. Reprocess it before generating a quiz." },
      409,
    );
  }

  let selectedTopics: string[];
  let sections: ExtractedSection[];
  try {
    selectedTopics = getSelectedQuizTopics(
      analysis.data,
      generationRequest.selectedTopics,
    );
    const { data: sourceRows, error: sourceError } = await supabase
      .from("document_sections")
      .select("source_id,position,title,text,page_or_location")
      .eq("document_id", document.id)
      .eq("user_id", user.id)
      .order("position");
    if (sourceError) {
      logger.error("Quiz source sections could not be loaded", {
        userId: user.id,
        documentId: document.id,
      });
      return json({ message: "We couldn’t load the source text. Please try again." }, 503);
    }
    sections = getQuizSections(
      analysis.data,
      (sourceRows ?? []).map((section) => ({
        sourceId: section.source_id,
        position: section.position,
        title: section.title,
        text: section.text,
        pageOrLocation: section.page_or_location,
      })),
      selectedTopics,
    );
  } catch (error) {
    if (error instanceof QuizGenerationError) {
      return json({ message: error.message }, error.status);
    }
    throw error;
  }

  let admin: ReturnType<typeof createAdminSupabaseClient>;
  try {
    admin = createAdminSupabaseClient();
  } catch {
    logger.error("Quiz persistence is not configured");
    return json({ message: "Quiz storage is not configured yet." }, 503);
  }

  const quizId = randomUUID();
  const quizTitle = getQuizTitle(analysis.data.title);
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
  const { error: insertError } = await admin.from("learning_quizzes").insert({
    id: quizId,
    user_id: user.id,
    source_document_id: document.id,
    title: quizTitle,
    question_count: generationRequest.questionCount,
    difficulty: generationRequest.difficulty,
    duration_minutes: generationRequest.durationMinutes,
    selected_topics: selectedTopics,
    generation_status: "generating",
    generation_model: model,
  });
  if (insertError) {
    logger.error("Quiz generation record could not be created", {
      userId: user.id,
      documentId: document.id,
      code: insertError.code ?? null,
    });
    return json({ message: "We couldn’t start quiz generation. Please try again." }, 503);
  }

  try {
    const questions = await generateAndValidateQuiz(
      geminiQuizGenerationProvider,
      {
        title: analysis.data.title,
        summary: analysis.data.summary,
        selectedTopics,
        questionCount: generationRequest.questionCount,
        difficulty: generationRequest.difficulty,
        sections,
      },
    );
    const { error: completeError } = await admin
      .from("learning_quizzes")
      .update({
        questions,
        generation_status: "ready",
        error_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quizId)
      .eq("user_id", user.id)
      .eq("generation_status", "generating");
    if (completeError) {
      logger.error("Validated quiz could not be saved", {
        quizId,
        userId: user.id,
        code: completeError.code ?? null,
      });
      return json(
        { message: "The quiz was generated but could not be saved. Please try again." },
        503,
      );
    }
    return json({ quizId }, 201);
  } catch (error) {
    const failure =
      error instanceof QuizGenerationError
        ? error
        : new QuizGenerationError(
            "quiz_unavailable",
            "Quiz generation failed. Please try again.",
            503,
          );
    logger.warn("Quiz generation failed", {
      quizId,
      userId: user.id,
      documentId: document.id,
      code: failure.code,
    });
    const { error: failUpdateError } = await admin
      .from("learning_quizzes")
      .update({
        generation_status: "failed",
        error_code: failure.code,
        questions: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quizId)
      .eq("user_id", user.id)
      .eq("generation_status", "generating");
    if (failUpdateError) {
      logger.error("Failed quiz status could not be saved", {
        quizId,
        code: failUpdateError.code ?? null,
      });
    }
    return json({ message: failure.message, quizId }, failure.status);
  }
}
