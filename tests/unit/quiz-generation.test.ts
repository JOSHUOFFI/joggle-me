import { describe, expect, it } from "vitest";
import {
  generateAndValidateQuiz,
  getQuizSections,
  getSelectedQuizTopics,
  QuizGenerationError,
  type QuizGenerationInput,
} from "@/lib/quizzes/generation";
import type { DocumentAnalysis, ExtractedSection } from "@/lib/materials/types";

const sections: ExtractedSection[] = [
  {
    sourceId: "S001",
    position: 1,
    title: "Evaporation",
    text: "The sun warms water and changes it from liquid into water vapour.",
    pageOrLocation: "Page 1",
  },
  {
    sourceId: "S002",
    position: 2,
    title: "Condensation",
    text: "Water vapour cools and condenses into liquid droplets that form clouds.",
    pageOrLocation: "Page 2",
  },
];

const analysis: DocumentAnalysis = {
  title: "The Water Cycle",
  subject: "Earth science",
  summary: "Water moves between the Earth's surface and atmosphere.",
  topics: [
    {
      name: "Evaporation",
      subtopics: ["Solar heating"],
      sourceRefs: ["S001"],
    },
    {
      name: "Condensation",
      subtopics: ["Cloud formation"],
      sourceRefs: ["S002"],
    },
  ],
  keyConcepts: [],
  definitions: [],
  importantFacts: [],
};

function question({
  id,
  difficulty = "easy",
  topic = "Evaporation",
  sourceRefs = ["S001"],
  questionText,
}: {
  id: string;
  difficulty?: "easy" | "medium" | "hard";
  topic?: string;
  sourceRefs?: string[];
  questionText?: string;
}) {
  return {
    question:
      questionText ??
      `Which statement best describes the process of ${id} in this study material?`,
    options: [
      { label: "A", text: `The correct process for ${id}` },
      { label: "B", text: `An unrelated process ${id}` },
      { label: "C", text: `A different process ${id}` },
      { label: "D", text: `Another incorrect process ${id}` },
    ],
    correctAnswer: "A",
    explanation: `The source explains that ${id} follows the stated process.`,
    difficulty,
    topic,
    sourceRefs,
  };
}

function input(
  questionCount: number,
  difficulty: QuizGenerationInput["difficulty"] = "easy",
): QuizGenerationInput {
  return {
    title: analysis.title,
    summary: analysis.summary,
    selectedTopics: ["Evaporation"],
    questionCount,
    difficulty,
    sections: [sections[0]],
  };
}

function withQuestions(questions: unknown[]) {
  return {
    generate: async () => ({ questions }),
  };
}

describe("quiz generation validation", () => {
  it("accepts a complete question set grounded in selected topics and sources", async () => {
    const result = await generateAndValidateQuiz(
      withQuestions([question({ id: "evaporation" })]),
      input(1),
    );

    expect(result).toHaveLength(1);
    expect(result[0].sourceRefs).toEqual(["S001"]);
  });

  it("rejects a response with the wrong question count or missing answer options", async () => {
    await expect(
      generateAndValidateQuiz(withQuestions([]), input(1)),
    ).rejects.toMatchObject({ code: "quiz_invalid" });

    const incomplete = question({ id: "incomplete" });
    incomplete.options.pop();
    await expect(
      generateAndValidateQuiz(withQuestions([incomplete]), input(1)),
    ).rejects.toMatchObject({ code: "quiz_invalid" });
  });

  it("rejects unsupported topics, source references, and incorrect difficulty", async () => {
    await expect(
      generateAndValidateQuiz(
        withQuestions([question({ id: "wrong-topic", topic: "Unselected" })]),
        input(1),
      ),
    ).rejects.toMatchObject({ code: "quiz_invalid" });
    await expect(
      generateAndValidateQuiz(
        withQuestions([question({ id: "wrong-source", sourceRefs: ["S099"] })]),
        input(1),
      ),
    ).rejects.toMatchObject({ code: "quiz_invalid" });
    await expect(
      generateAndValidateQuiz(
        withQuestions([question({ id: "wrong-level", difficulty: "hard" })]),
        input(1, "easy"),
      ),
    ).rejects.toMatchObject({ code: "quiz_invalid" });
  });

  it("rejects exact and near-duplicate questions", async () => {
    const first = question({ id: "water evaporation" });
    const nearDuplicate = {
      ...first,
      question: "Which statement best describes the process of water evaporation within this study material?",
    };
    await expect(
      generateAndValidateQuiz(
        withQuestions([first, nearDuplicate]),
        input(2),
      ),
    ).rejects.toMatchObject({ code: "quiz_invalid" });
    await expect(
      generateAndValidateQuiz(
        withQuestions([first, { ...first }]),
        input(2),
      ),
    ).rejects.toMatchObject({ code: "quiz_invalid" });
  });

  it("enforces the requested mixed-difficulty distribution", async () => {
    const mixedQuestions = [
      question({
        id: "one",
        difficulty: "easy",
        questionText: "Which change turns liquid water into vapour during this cycle?",
      }),
      question({
        id: "two",
        difficulty: "medium",
        questionText: "What happens to water vapour as it cools and forms cloud droplets?",
      }),
      question({
        id: "three",
        difficulty: "hard",
        questionText: "Which sequence describes water vapour cooling before liquid droplets appear?",
      }),
    ];
    const result = await generateAndValidateQuiz(
      withQuestions(mixedQuestions),
      input(3, "mixed"),
    );
    expect(result.map((item) => item.difficulty)).toEqual([
      "easy",
      "medium",
      "hard",
    ]);

    await expect(
      generateAndValidateQuiz(
        withQuestions(mixedQuestions.slice(0, 2)),
        input(3, "mixed"),
      ),
    ).rejects.toBeInstanceOf(QuizGenerationError);
  });

  it("splits larger mixed quizzes and preserves the total difficulty distribution", async () => {
    const prompts = [
      "What supplies heat for water to evaporate at the surface?",
      "Which direction does water vapour travel after evaporation?",
      "What change happens to rising vapour as it cools?",
      "How do tiny liquid droplets gather to form clouds?",
      "What makes cloud droplets fall to the Earth's surface?",
      "Which forms can precipitation take in the cycle?",
      "Where does water collect after falling?",
      "How does runoff move water across land?",
      "What do plants release through transpiration?",
      "How does transpiration add water to the atmosphere?",
      "What starts the movement of water from liquid to vapour?",
      "Which stage returns water to rivers and lakes?",
      "Why do droplets become heavy before precipitation?",
      "What happens to vapour before cloud formation?",
      "How does the water cycle repeat after collection?",
    ];
    let batchIndex = 0;
    const provider = {
      generate: async (batch: QuizGenerationInput) => {
        const index = batchIndex++;
        const counts = batch.difficultyCounts ?? {
          easy: batch.difficulty === "easy" ? batch.questionCount : 0,
          medium: batch.difficulty === "medium" ? batch.questionCount : 0,
          hard: batch.difficulty === "hard" ? batch.questionCount : 0,
        };
        let itemIndex = 0;
        const questions = (Object.entries(counts) as [
          "easy" | "medium" | "hard",
          number,
        ][]).flatMap(([difficulty, count]) =>
          Array.from({ length: count }, () => {
            const promptIndex = index * 10 + itemIndex++;
            return question({
              id: `batch-${index}-${itemIndex}`,
              difficulty,
              questionText: prompts[promptIndex],
            });
          }),
        );
        return { questions };
      },
    };

    const result = await generateAndValidateQuiz(provider, input(15, "mixed"));
    expect(batchIndex).toBe(2);
    expect(result).toHaveLength(15);
    expect(result.filter((item) => item.difficulty === "easy")).toHaveLength(5);
    expect(result.filter((item) => item.difficulty === "medium")).toHaveLength(5);
    expect(result.filter((item) => item.difficulty === "hard")).toHaveLength(5);
  });

  it("accepts canonical extracted topics and limits source text to their citations", () => {
    const selected = getSelectedQuizTopics(analysis, ["solar heating"]);
    const selectedSections = getQuizSections(analysis, sections, selected);

    expect(selected).toEqual(["Solar heating"]);
    expect(selectedSections.map((section) => section.sourceId)).toEqual(["S001"]);
    expect(() => getSelectedQuizTopics(analysis, ["Unrelated topic"])).toThrow(
      "Choose topics that belong to this document.",
    );
  });
});
