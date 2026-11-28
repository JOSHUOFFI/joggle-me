import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAdminSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: mocks.createAdminSupabaseClient,
}));

import { GET } from "@/app/api/cron/guest-workspace-retention/route";

describe("guest workspace retention endpoint", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
    mocks.createAdminSupabaseClient.mockReset();
  });

  it("rejects requests unless the scheduled-job secret is configured and supplied", async () => {
    delete process.env.CRON_SECRET;
    const missing = await GET(new Request("http://localhost/api/cron/guest-workspace-retention") as never);
    expect(missing.status).toBe(401);

    process.env.CRON_SECRET = "development-test-secret";
    const wrong = await GET(new Request("http://localhost/api/cron/guest-workspace-retention", {
      headers: { Authorization: "Bearer wrong-secret" },
    }) as never);
    expect(wrong.status).toBe(401);
    expect(mocks.createAdminSupabaseClient).not.toHaveBeenCalled();
  });
});
