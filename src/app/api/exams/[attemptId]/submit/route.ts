import { z } from "zod";
import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import {
  attemptAnswersSchema,
  parseAttemptRpcResult,
} from "@/lib/exams/types";
import {
  examJson,
  getExamLearnerContext,
  isSameOriginExamRequest,
} from "@/lib/exams/request";

const requestSchema = z.object({
  answers: attemptAnswersSchema.optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ attemptId: string }> },
) {
  if (!isSameOriginExamRequest(request)) {
    return examJson({ message: "The examination request origin could not be verified." }, 403);
  }

  const learner = await getExamLearnerContext();
  if (!learner.ok) return learner.response;

  const { attemptId } = await context.params;
  const parsedAttemptId = z.uuid().safeParse(attemptId);
  if (!parsedAttemptId.success) {
    return examJson({ message: "The examination attempt could not be found." }, 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return examJson({ message: "The submission could not be read." }, 400);
  }
  const parsedBody = requestSchema.safeParse(body);
  if (!parsedBody.success) {
    return examJson({ message: "One or more selected answers are invalid." }, 400);
  }

  if (parsedBody.data.answers) {
    const { data: saved, error: saveError } = await learner.supabase.rpc(
      "guest_save_quiz_attempt_answers",
      {
        p_token_hash: learner.user.guestTokenHash,
        p_attempt_id: parsedAttemptId.data,
        p_answers: parsedBody.data.answers,
      },
    );
    if (saveError) {
      if (saveError.code === "42501") {
        return examJson({ message: "That examination attempt could not be found." }, 404);
      }
      if (saveError.code === "22023") {
        return examJson({ message: "One or more selected answers are invalid." }, 400);
      }
      logger.error("Final examination answers could not be saved", {
        code: saveError.code ?? null,
      });
      return examJson({ message: "We couldn’t save your final answers. Please retry." }, 503);
    }

    const savedAttempt = parseAttemptRpcResult(saved);
    if (!savedAttempt) {
      logger.error("Final answer save returned invalid examination state");
      return examJson({ message: "We couldn’t confirm your final answers. Please retry." }, 503);
    }
    if (savedAttempt.status === "submitted") {
      return examJson({ state: savedAttempt });
    }
  }

  const { data, error } = await learner.supabase.rpc("guest_submit_quiz_attempt", {
    p_token_hash: learner.user.guestTokenHash,
    p_attempt_id: parsedAttemptId.data,
  });
  if (error) {
    if (error.code === "42501") {
      return examJson({ message: "That examination attempt could not be found." }, 404);
    }
    logger.error("Examination submission could not be marked", {
      code: error.code ?? null,
    });
    return examJson({ message: "We couldn’t submit the examination. Please retry." }, 503);
  }

  const attempt = parseAttemptRpcResult(data);
  if (!attempt) {
    logger.error("Examination submission returned invalid result state");
    return examJson({ message: "We couldn’t confirm the examination result. Please retry." }, 503);
  }

  return examJson({ state: attempt });
}
