import { z } from "zod";

const containsContactInfo = (value: string) =>
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value) ||
  /(^|[^0-9])\+?[0-9][0-9 ()-]{8,}[0-9]([^0-9]|$)/.test(value);

export function textSchema(minimum: number, maximum: number) {
  return z.string().trim().min(minimum).max(maximum).refine(
    (value) => !containsContactInfo(value),
    "Do not include email addresses or phone numbers.",
  );
}

export const uuidSchema = z.uuid();

export function parseTagList(value: FormDataEntryValue | null) {
  if (value === null || value === "") return [];
  if (typeof value !== "string") return null;
  const tags = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  if (tags.length > 10 || tags.some((item) => item.length > 40 || containsContactInfo(item))) {
    return null;
  }
  return tags;
}

export function isSafeAvatarUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.search.length === 0 &&
      url.hash.length === 0 &&
      value.length <= 500;
  } catch {
    return false;
  }
}
