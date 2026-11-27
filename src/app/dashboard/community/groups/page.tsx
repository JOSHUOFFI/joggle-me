import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CommunityDisabled, CommunityFeedback, CommunityNavigation, CommunityPageHeader } from "@/components/community-ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import {
  CommunityDataError,
  loadCommunityFeatures,
  loadStudyGroups,
} from "@/lib/community/data";
import {
  createStudyGroupAction,
  joinStudyGroupAction,
  reviewGroupRequestAction,
} from "@/lib/actions/community";

type SearchParams = Promise<{ notice?: string; error?: string }>;

export default async function StudyGroupsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase, user } = await requireRole(["learner"]);
  const [features, params] = await Promise.all([loadCommunityFeatures(supabase), searchParams]);
  return (
    <AppShell>
      <CommunityNavigation />
      <CommunityPageHeader
        eyebrow="Learn together"
        title="Study groups"
        description="Find learners with shared interests, join a public group, or request access to a private study group."
      />
      <CommunityFeedback notice={params.notice} error={params.error} />
      {!features.community_enabled || !features.study_groups_enabled ? (
        <CommunityDisabled feature="Study groups" />
      ) : (
        <GroupsContent supabase={supabase} userId={user.id} />
      )}
    </AppShell>
  );
}

async function GroupsContent({
  supabase,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof requireRole>>["supabase"];
  userId: string;
}) {
  let groups: Awaited<ReturnType<typeof loadStudyGroups>>;
  try {
    groups = await loadStudyGroups(supabase, userId);
  } catch (error) {
    if (!(error instanceof CommunityDataError)) throw error;
    return <Card className="p-5 text-sm text-red-700" role="alert">{error.message}</Card>;
  }
  const requestsByGroup = new Map<string, typeof groups.requests>();
  for (const request of groups.requests) {
    const list = requestsByGroup.get(request.group_id) ?? [];
    list.push(request);
    requestsByGroup.set(request.group_id, list);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
      <div className="space-y-4">
        {groups.groups.length ? groups.groups.map((group) => {
          const myStatus = group.stats.my_status;
          return (
            <Card key={group.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#7655D9]">{group.subject} · {group.visibility}</p>
                  <h2 className="mt-1 text-xl font-bold text-[#35216B]">
                    <Link href={`/dashboard/community/groups/${group.id}`} className="hover:underline">{group.name}</Link>
                  </h2>
                </div>
                <span className="rounded-full bg-[#ECE7FB] px-3 py-1 text-xs font-semibold text-[#35216B]">
                  {group.stats.member_count} members
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#77758A]">{group.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {myStatus === "active" ? (
                  <span className="text-sm font-semibold text-emerald-800">You are a member</span>
                ) : myStatus === "pending" ? (
                  <span className="text-sm font-semibold text-amber-800">Membership request pending</span>
                ) : (
                  <form action={joinStudyGroupAction} className="flex items-center gap-2">
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="returnTo" value="/dashboard/community/groups" />
                    <Button type="submit" variant="secondary" size="sm">
                      {group.visibility === "public" ? "Join group" : "Request to join"}
                    </Button>
                  </form>
                )}
                <Link href={`/dashboard/community/groups/${group.id}`} className="text-sm font-semibold text-[#7655D9] hover:underline">
                  View group
                </Link>
              </div>

              {group.stats.is_admin && (requestsByGroup.get(group.id)?.length ?? 0) > 0 && (
                <div className="mt-5 border-t border-[#ECEAF5] pt-4">
                  <h3 className="text-sm font-bold text-[#35216B]">Membership requests</h3>
                  <ul className="mt-2 space-y-2">
                    {requestsByGroup.get(group.id)?.map((request) => (
                      <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F7F7FC] p-3">
                        <span className="text-sm">{request.displayName}</span>
                        <div className="flex gap-2">
                          <RequestDecision id={request.id} approve />
                          <RequestDecision id={request.id} approve={false} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          );
        }) : (
          <Card className="p-8 text-center">
            <h2 className="font-bold text-[#35216B]">No study groups yet</h2>
            <p className="mt-2 text-sm text-[#77758A]">Create a group to study a subject together.</p>
          </Card>
        )}
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-[#35216B]">Create a study group</h2>
        <form action={createStudyGroupAction} className="mt-4 space-y-3">
          <input type="hidden" name="returnTo" value="/dashboard/community/groups" />
          <label htmlFor="groupName" className="block text-sm font-semibold">Group name</label>
          <input id="groupName" name="name" minLength={3} maxLength={80} required placeholder="e.g. Biology revision" className="h-11 w-full rounded-xl border border-[#DDD8EF] px-3 text-sm" />
          <label htmlFor="groupSubject" className="block text-sm font-semibold">Subject</label>
          <input id="groupSubject" name="subject" maxLength={80} required placeholder="e.g. Biology" className="h-11 w-full rounded-xl border border-[#DDD8EF] px-3 text-sm" />
          <label htmlFor="groupDescription" className="block text-sm font-semibold">Description</label>
          <textarea id="groupDescription" name="description" maxLength={1200} required placeholder="What will your group study?" className="min-h-24 w-full rounded-xl border border-[#DDD8EF] p-3 text-sm" />
          <label htmlFor="groupVisibility" className="block text-sm font-semibold">Visibility</label>
          <select id="groupVisibility" name="visibility" className="h-11 w-full rounded-xl border border-[#DDD8EF] bg-white px-3 text-sm">
            <option value="public">Public — learners can join</option>
            <option value="private">Private — request approval</option>
          </select>
          <p className="text-xs text-[#77758A]">As the creator, you will be the group administrator.</p>
          <Button type="submit" className="w-full">Create group</Button>
        </form>
      </Card>
    </div>
  );
}

function RequestDecision({ id, approve }: { id: string; approve: boolean }) {
  return (
    <form action={reviewGroupRequestAction}>
      <input type="hidden" name="membershipId" value={id} />
      <input type="hidden" name="approve" value={approve ? "true" : "false"} />
      <input type="hidden" name="returnTo" value="/dashboard/community/groups" />
      <Button type="submit" variant={approve ? "primary" : "secondary"} size="sm">
        {approve ? "Approve" : "Decline"}
      </Button>
    </form>
  );
}
