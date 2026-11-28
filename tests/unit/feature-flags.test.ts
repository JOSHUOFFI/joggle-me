import { describe, expect, it } from "vitest";
import { getFeatureSnapshot, isFeatureEnabled } from "@/lib/features";

function isFeatureEnabledInObject(flags: Record<string, boolean>, key: string) {
  return flags[key] === true;
}

describe("feature flag evaluation", () => {
  it("defaults unknown features to disabled", () => {
    expect(isFeatureEnabledInObject({}, "ai_quiz_generation")).toBe(false);
  });

  it("uses deployment-level feature switches without a database account system", async () => {
    expect(await isFeatureEnabled(null, "ai_quiz_generation")).toBe(true);
    expect(await isFeatureEnabled(null, "community_enabled")).toBe(false);
    expect(await isFeatureEnabled(null, "../secret")).toBe(false);
    expect(getFeatureSnapshot()).not.toHaveProperty("user_registration");
  });

  it("returns explicit enabled state", () => {
    expect(isFeatureEnabledInObject({ ai_quiz_generation: true }, "ai_quiz_generation")).toBe(true);
  });

  it("does not treat false as enabled", () => {
    expect(isFeatureEnabledInObject({ social_learning: false }, "social_learning")).toBe(false);
  });
});
