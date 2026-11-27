import { z } from "zod";

export const quizDifficultySchema = z.enum(["easy", "medium", "hard", "mixed"]);
export type QuizDifficulty = z.infer<typeof quizDifficultySchema>;

const questionDifficultySchema = z.enum(["easy", "medium", "hard"]);
const answerLabelSchema = z.enum(["A", "B", "C", "D"]);

export const quizQuestionFieldsSchema = z.object({
  question: z.string().trim().min(10).max(1_000),
  options: z.array(
    z.object({
      label: answerLabelSchema,
      text: z.string().trim().min(1).max(500),
    }),
  ).length(4),
  correctAnswer: answerLabelSchema,
  explanation: z.string().trim().min(10).max(1_000),
  difficulty: questionDifficultySchema,
  topic: z.string().trim().min(1).max(200),
  sourceRefs: z.array(z.string().regex(/^S\d{3}$/)).min(1).max(12),
});

export const quizQuestionSchema = quizQuestionFieldsSchema.superRefine((question, context) => {
  const labels = new Set(question.options.map((option) => option.label));
  if (labels.size !== 4) {
    context.addIssue({
      code: "custom",
      path: ["options"],
      message: "Each answer label A, B, C, and D must appear exactly once.",
    });
  }
  const answers = question.options.map((option) => option.text.toLocaleLowerCase());
  if (new Set(answers).size !== answers.length) {
    context.addIssue({
      code: "custom",
      path: ["options"],
      message: "Answer options must be distinct.",
    });
  }
});

export const quizQuestionsSchema = z.array(quizQuestionSchema).min(1).max(30);
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const quizGenerationRequestSchema = z.object({
  documentId: z.uuid(),
  questionCount: z.number().int().min(1).max(30),
  difficulty: quizDifficultySchema,
  durationMinutes: z.number().int().min(1).max(180),
  selectedTopics: z.array(z.string().trim().min(1).max(200)).min(1).max(800),
}).superRefine((request, context) => {
  if (new Set(request.selectedTopics).size !== request.selectedTopics.length) {
    context.addIssue({
      code: "custom",
      path: ["selectedTopics"],
      message: "Selected topics must be unique.",
    });
  }
});

export type QuizGenerationRequest = z.infer<
  typeof quizGenerationRequestSchema
>;
