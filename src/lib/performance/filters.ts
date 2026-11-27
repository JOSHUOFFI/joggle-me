import { z } from "zod";
import type { PerformanceAttemptRecord } from "@/lib/performance/data";

const filtersSchema = z.object({
  subject: z.string().trim().min(1).max(200).optional(),
  sourceDocumentId: z.uuid().optional(),
  fromDate: z.iso.date().optional(),
  toDate: z.iso.date().optional(),
  page: z.number().int().min(1).max(100_000),
}).superRefine((filters, context) => {
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
    context.addIssue({
      code: "custom",
      path: ["toDate"],
      message: "The end date must be on or after the start date.",
    });
  }
});

export type PerformanceFilters = z.infer<typeof filtersSchema>;
export type PerformanceSearchParams = {
  subject?: string | string[];
  source?: string | string[];
  from?: string | string[];
  to?: string | string[];
  page?: string | string[];
};

function singleValue(value: string | string[] | undefined) {
  if (typeof value === "string") return value;
  return value?.length === 1 ? value[0] : undefined;
}

export function parsePerformanceFilters(searchParams: PerformanceSearchParams) {
  const rawPage = singleValue(searchParams.page);
  const filters = filtersSchema.safeParse({
    subject: singleValue(searchParams.subject) || undefined,
    sourceDocumentId: singleValue(searchParams.source) || undefined,
    fromDate: singleValue(searchParams.from) || undefined,
    toDate: singleValue(searchParams.to) || undefined,
    page: rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : rawPage ? NaN : 1,
  });
  return filters.success
    ? { valid: true as const, filters: filters.data }
    : { valid: false as const };
}

export function filterPerformanceAttempts(
  attempts: PerformanceAttemptRecord[],
  filters: PerformanceFilters,
) {
  return attempts.filter((attempt) => {
    const submittedDate = attempt.submittedAt.slice(0, 10);
    return (
      (!filters.subject || attempt.subject === filters.subject) &&
      (!filters.sourceDocumentId ||
        attempt.sourceDocumentId === filters.sourceDocumentId) &&
      (!filters.fromDate || submittedDate >= filters.fromDate) &&
      (!filters.toDate || submittedDate <= filters.toDate)
    );
  });
}
