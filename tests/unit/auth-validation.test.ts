import { describe, expect, it } from "vitest";
import {
  loginSchema,
  passwordResetSchema,
  registrationSchema,
  profileSchema,
} from "@/lib/validation/auth";
import { normalizeSupabaseProjectUrl } from "@/lib/env";
import { parseAppRoles } from "@/lib/auth";
import {
  createPasswordRecoveryMarker,
  isPasswordRecoveryMarkerValid,
} from "@/lib/auth/recovery";

describe("authentication validation", () => {
  it("rejects weak registration passwords", () => {
    const result = registrationSchema.safeParse({
      firstName: "Ada",
      lastName: "Lovelace",
      username: "ada.math",
      email: "ada@example.com",
      password: "password",
      confirmPassword: "password",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a valid registration", () => {
    const result = registrationSchema.safeParse({
      firstName: "Ada",
      lastName: "Lovelace",
      username: "ada.math",
      email: "ada@example.com",
      password: "StrongPass1!",
      confirmPassword: "StrongPass1!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched password reset values", () => {
    const result = passwordResetSchema.safeParse({
      password: "StrongPass1!",
      confirmPassword: "DifferentPass1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects weak password reset values", () => {
    expect(
      passwordResetSchema.safeParse({
        password: "weakpassword",
        confirmPassword: "weakpassword",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid login email", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });

  it("restricts learner categories", () => {
    const base = {
      firstName: "Ada",
      lastName: "Lovelace",
      username: "ada.math",
      learnerCategory: "unknown",
    };
    expect(profileSchema.safeParse(base).success).toBe(false);
  });
});

describe("password recovery session marker", () => {
  const userId = "4cb076da-c460-4978-bbb8-3f5583844e5e";
  const accessToken = "verified-access-token";

  it("validates only the marker for its verified user session", () => {
    const marker = createPasswordRecoveryMarker(userId, accessToken);

    expect(isPasswordRecoveryMarkerValid(marker, userId, accessToken)).toBe(true);
    expect(isPasswordRecoveryMarkerValid(marker, "another-user", accessToken)).toBe(false);
    expect(isPasswordRecoveryMarkerValid(marker, userId, "another-token")).toBe(false);
    expect(isPasswordRecoveryMarkerValid(undefined, userId, accessToken)).toBe(false);
  });
});

describe("Supabase project URL normalization", () => {
  it("accepts a project root URL", () => {
    expect(normalizeSupabaseProjectUrl("https://example.supabase.co")).toBe(
      "https://example.supabase.co",
    );
  });

  describe("database role response parsing", () => {
    it("extracts valid role values from PostgREST rows", () => {
      expect(parseAppRoles([{ role: "platform_owner" }, { role: "learner" }])).toEqual([
        "platform_owner",
        "learner",
      ]);
    });

    it("ignores malformed and unknown role rows", () => {
      expect(parseAppRoles([{ role: "root" }, null, "teacher"])).toEqual([]);
    });
  });

  it("normalizes the REST endpoint URL to the project root", () => {
    expect(
      normalizeSupabaseProjectUrl("https://example.supabase.co/rest/v1/"),
    ).toBe("https://example.supabase.co");
  });

  it("rejects unrelated paths", () => {
    expect(() =>
      normalizeSupabaseProjectUrl("https://example.supabase.co/auth/v1"),
    ).toThrow();
  });
});
