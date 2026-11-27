import { describe, expect, it } from "vitest";
import { isFeatureEnabled as checkFeatureWithDatabase } from "@/lib/features";

function isFeatureEnabledInObject(flags: Record<string, boolean>, key: string) {
  return flags[key] === true;
}

describe("feature flag evaluation", () => {
  it("defaults unknown features to disabled", () => {
    expect(isFeatureEnabledInObject({}, "ai_quiz_generation")).toBe(false);
  });

  describe("secure feature flag adapter", () => {
    it("fails closed when the RPC reports an error", async () => {
      const supabase = {
        rpc: async () => ({ data: null, error: new Error("database unavailable") }),
      };
      await expect(
        checkFeatureWithDatabase(supabase as never, "ai_quiz_generation"),
      ).resolves.toBe(false);
    });

    it("fails closed for missing and disabled states", async () => {
      const missing = { rpc: async () => ({ data: null, error: null }) };
      const disabled = { rpc: async () => ({ data: false, error: null }) };
      await expect(checkFeatureWithDatabase(missing as never, "social_learning")).resolves.toBe(false);
      await expect(checkFeatureWithDatabase(disabled as never, "social_learning")).resolves.toBe(false);
    });

    it("accepts an explicit enabled state", async () => {
      const enabled = { rpc: async () => ({ data: true, error: null }) };
      await expect(checkFeatureWithDatabase(enabled as never, "social_learning")).resolves.toBe(true);
    });

    it("rejects invalid flag keys", async () => {
      const supabase = { rpc: async () => ({ data: true, error: null }) };
      await expect(checkFeatureWithDatabase(supabase as never, "../secret")).resolves.toBe(false);
    });
  });

  it("returns explicit enabled state", () => {
    expect(isFeatureEnabledInObject({ ai_quiz_generation: true }, "ai_quiz_generation")).toBe(true);
  });

  it("does not treat false as enabled", () => {
    expect(isFeatureEnabledInObject({ social_learning: false }, "social_learning")).toBe(false);
  });
});
