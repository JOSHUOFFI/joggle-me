"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  examQuestionViewListSchema,
  quizAttemptStateSchema,
} from "@/lib/exams/types";

const responseSchema = z.object({
  state: quizAttemptStateSchema.optional(),
  questions: examQuestionViewListSchema.optional(),
  message: z.string().optional(),
});

export function ExamStartButton({
  quizId,
  disabled = false,
}: {
  quizId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/exams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId }),
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The server returned an unreadable response. Please retry.");
      }

      const parsed = responseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("The examination could not be loaded. Please retry.");
      }
      if (!response.ok || !parsed.data.state) {
        throw new Error(parsed.data.message ?? "The examination could not be started.");
      }

      const { state } = parsed.data;
      router.push(
        state.status === "submitted"
          ? `/dashboard/exams/${state.attempt_id}/results`
          : `/dashboard/exams/${state.attempt_id}`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The examination could not be started. Please retry.",
      );
      setPending(false);
    }
  };

  return (
    <div>
      <Button type="button" onClick={start} disabled={disabled || pending}>
        {pending ? "Preparing examination…" : "Start examination"}
      </Button>
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}
