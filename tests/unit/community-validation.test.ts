import { describe, expect, it } from "vitest";
import {
  isSafeAvatarUrl,
  parseTagList,
  textSchema,
} from "@/lib/community/validation";

describe("community content validation", () => {
  it("rejects email addresses and phone numbers in community text", () => {
    expect(textSchema(1, 200).safeParse("Contact me at learner@example.com").success).toBe(false);
    expect(textSchema(1, 200).safeParse("Call me at +1 (555) 123-4567").success).toBe(false);
    expect(textSchema(1, 200).safeParse("I am studying cell biology").success).toBe(true);
  });

  it("accepts bounded unique profile tags and rejects invalid lists", () => {
    expect(parseTagList("Biology, Mathematics, Biology")).toEqual(["Biology", "Mathematics"]);
    expect(parseTagList("biology@example.com")).toBeNull();
    expect(parseTagList(Array.from({ length: 11 }, (_, index) => `subject-${index}`).join(","))).toBeNull();
    expect(parseTagList(null)).toEqual([]);
  });

  it("only accepts HTTPS avatar links without query or fragment data", () => {
    expect(isSafeAvatarUrl("https://images.example.test/avatar.png")).toBe(true);
    expect(isSafeAvatarUrl("http://images.example.test/avatar.png")).toBe(false);
    expect(isSafeAvatarUrl("https://images.example.test/avatar.png?token=private")).toBe(false);
    expect(isSafeAvatarUrl("https://images.example.test/avatar.png#private")).toBe(false);
  });
});
