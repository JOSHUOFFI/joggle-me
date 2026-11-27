import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { CommunityFeedback } from "@/components/community-ui";
import { requireRole } from "@/lib/auth";
import { moderateCommunityReportAction, setCommunitySuspensionAction } from "@/lib/actions/community";
import {
  CommunityDataError,
  loadCommunityModeration,
} from "@/lib/community/data";

type SearchParams = Promise<{ notice?: string; error?: string; q?: string }>;

const targetLabels: Record<string, string> = {
  post: "Post",
  comment: "Comment",
  question: "Question",
  answer: "Answer",
};

export default async function OwnerCommunityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase, user } = await requireRole([
    "platform_owner",
    "platform_administrator",
  ]);
  const params = await searchParams;
  let moderation: Awaited<ReturnType<typeof loadCommunityModeration>> | null = null;
  try {
    moderation = await loadCommunityModeration(supabase, params.q?.slice(0, 100));
  } catch (error) {
    if (!(error instanceof CommunityDataError)) throw error;
  }

  return (
    <>
      <div className="mb-6">
        <p className="text-sm font-bold text-[#7655D9]">Platform controls</p>
        <h1 className="mt-1 text-3xl font-black text-[#17152A]">Community management</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#77758A]">
          Review reported content, manage learner participation, and monitor community activity.
        </p>
      </div>
      <CommunityFeedback notice={params.notice} error={params.error} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#77758A]">Community controls and content are enforced by database policies and owner-authorized actions.</p>
        <Link href="/owner/features" className="rounded-xl border border-[#DDD8EF] bg-white px-4 py-2 text-sm font-semibold text-[#35216B]">Manage feature flags</Link>
      </div>
      {!moderation ? (
        <Card className="p-5 text-sm text-red-700" role="alert">
          Community moderation data could not be loaded. Confirm the Phase 7 database migration is applied and try again.
        </Card>
      ) : (
        <>
          <section aria-label="Community activity statistics" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Stat label="Visible posts" value={moderation.overview.visible_posts} />
            <Stat label="Visible questions" value={moderation.overview.visible_questions} />
            <Stat label="Study groups" value={moderation.overview.study_groups} />
            <Stat label="Active memberships" value={moderation.overview.active_memberships} />
            <Stat label="Pending reports" value={moderation.overview.pending_reports} />
            <Stat label="Active community suspensions" value={moderation.overview.suspended_learners} />
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-xl font-bold text-[#35216B]">Reported content</h2>
            {moderation.reports.length ? (
              <div className="space-y-4">
                {moderation.reports.map((report) => {
                  const isOwnReport = report.reported_by === user.id;
                  return (
                    <Card key={report.id} className="p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#7655D9]">
                            {targetLabels[report.target_type]} · Reported {new Date(report.created_at).toLocaleString()}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#343247]">
                            {report.content?.title ? `${report.content.title}\n` : ""}
                            {report.content?.body ?? "Reported content is no longer available."}
                          </p>
                          <p className="mt-3 text-sm"><strong>Reason:</strong> {report.reason}</p>
                        </div>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Pending review</span>
                      </div>
                      {isOwnReport ? (
                        <p className="mt-4 rounded-lg bg-[#F7F7FC] p-3 text-sm text-[#77758A]">
                          You submitted this report and cannot review it. Another authorized moderator must handle it.
                        </p>
                      ) : (
                        <form action={moderateCommunityReportAction} className="mt-5 grid gap-3 border-t border-[#ECEAF5] pt-4 sm:grid-cols-2">
                          <input type="hidden" name="reportId" value={report.id} />
                          <label className="text-sm font-semibold">Decision
                            <select name="decision" className="mt-1 h-11 w-full rounded-xl border border-[#DDD8EF] bg-white px-3 text-sm font-normal">
                              <option value="upheld">Upheld</option>
                              <option value="dismissed">Dismissed</option>
                            </select>
                          </label>
                          <label className="text-sm font-semibold">Resolution note
                            <input name="resolution" minLength={3} maxLength={500} required placeholder="Briefly explain the decision" className="mt-1 h-11 w-full rounded-xl border border-[#DDD8EF] px-3 text-sm font-normal" />
                          </label>
                          <label className="flex items-start gap-2 text-sm sm:col-span-2">
                            <input type="checkbox" name="removeContent" value="true" className="mt-1 size-4 accent-[#7655D9]" />
                            <span>Remove this content (only available when the report is upheld).</span>
                          </label>
                          <Button type="submit" className="sm:col-span-2">Record moderation decision</Button>
                        </form>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-7 text-center text-sm text-[#77758A]">There are no pending reports. Reported content will appear here for review.</Card>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-[#35216B]">Learner participation</h2>
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-[#ECEAF5] p-4 sm:flex-row sm:items-end sm:justify-between">
                <p className="max-w-2xl text-sm text-[#77758A]">
                  Search active learners to manage community participation. A suspension does not affect login, exams, or learning records.
                </p>
                <form method="get" className="flex w-full gap-2 sm:max-w-sm">
                  <input name="q" defaultValue={params.q ?? ""} maxLength={100} placeholder="Search learner name" className="h-10 min-w-0 flex-1 rounded-lg border border-[#DDD8EF] px-3 text-sm" />
                  <Button type="submit" variant="secondary" size="sm">Search</Button>
                </form>
              </div>
              <ul className="divide-y divide-[#ECEAF5]">
                {moderation.learners.map((learner) => {
                  const suspended = learner.suspended;
                  return (
                    <li key={learner.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
                      <div>
                        <p className="font-semibold text-[#35216B]">{learner.display_name}</p>
                        <p className="text-xs text-[#77758A]">
                          {suspended
                            ? `Suspended until ${new Date(learner.community_suspended_until!).toLocaleString()}`
                            : "Community participation active"}
                        </p>
                      </div>
                      <form action={setCommunitySuspensionAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="userId" value={learner.user_id} />
                        <input type="hidden" name="suspend" value={suspended ? "false" : "true"} />
                        {!suspended && (
                          <select name="durationDays" defaultValue="7" aria-label="Suspension duration" className="h-10 rounded-lg border border-[#DDD8EF] bg-white px-2 text-sm">
                            <option value="1">1 day</option>
                            <option value="7">7 days</option>
                            <option value="30">30 days</option>
                            <option value="90">90 days</option>
                          </select>
                        )}
                        <ConfirmActionButton
                          confirmation={suspended ? "Restore community participation for this learner?" : "Suspend this learner from community participation?"}
                          className={`rounded-xl px-3 py-2 text-sm font-semibold ${suspended ? "border border-[#DDD8EF] text-[#35216B]" : "bg-red-50 text-red-700"}`}
                        >
                          {suspended ? "Restore" : "Suspend"}
                        </ConfirmActionButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
              {!moderation.learners.length && <p className="p-6 text-center text-sm text-[#77758A]">No learners match this search.</p>}
            </Card>
          </section>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-sm text-[#77758A]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#35216B]">{value.toLocaleString()}</p>
    </Card>
  );
}
