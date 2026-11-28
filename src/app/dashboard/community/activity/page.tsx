import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CommunityDisabled, CommunityFeedback, CommunityNavigation, CommunityPageHeader } from "@/components/community-ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireGuestWorkspace } from "@/lib/guest-workspace";
import {
  CommunityDataError,
  loadCommunityBlocks,
  loadCommunityFeatures,
  loadCommunityNotifications,
} from "@/lib/community/data";
import {
  markCommunityNotificationReadAction,
  unblockCommunityMemberAction,
} from "@/lib/actions/community";

type SearchParams = Promise<{ notice?: string; error?: string }>;

const notificationLabels: Record<string, string> = {
  post_comment: "commented on your post",
  comment_reply: "replied to your comment",
  answer_comment: "commented on an answer",
  question_answer: "answered your question",
  post_reaction: "reacted to your post",
  group_request: "requested to join your study group",
  group_approved: "approved your group membership",
  group_rejected: "declined your group membership request",
};

function notificationHref(targetType: string, targetId: string) {
  switch (targetType) {
    case "post":
      return `/dashboard/community#post-${targetId}`;
    case "comment":
      return `/dashboard/community#comment-${targetId}`;
    case "answer":
    case "question":
      return `/dashboard/community/questions#${targetType}-${targetId}`;
    case "study_group":
      return `/dashboard/community/groups/${targetId}`;
    default:
      return "/dashboard/community";
  }
}

export default async function CommunityActivityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase, user } = await requireGuestWorkspace();
  const [features, params] = await Promise.all([
    loadCommunityFeatures(),
    searchParams,
  ]);
  if (!features.community_enabled) {
    return (
      <AppShell>
        <CommunityNavigation />
        <CommunityPageHeader eyebrow="Your community" title="My community activity" description="Review updates and manage who you have blocked." />
        <CommunityDisabled />
      </AppShell>
    );
  }

  let notifications: Awaited<ReturnType<typeof loadCommunityNotifications>> = [];
  let blocks: Awaited<ReturnType<typeof loadCommunityBlocks>> = [];
  try {
    const [blockRows, notificationRows] = await Promise.all([
      loadCommunityBlocks(supabase, user.id),
      features.community_notifications_enabled
        ? loadCommunityNotifications(supabase, user.id)
        : Promise.resolve([]),
    ]);
    blocks = blockRows;
    notifications = notificationRows;
  } catch (error) {
    if (!(error instanceof CommunityDataError)) throw error;
    return (
      <AppShell>
        <CommunityNavigation />
        <CommunityPageHeader eyebrow="Your community" title="My community activity" description="Review updates and manage who you have blocked." />
        <Card className="p-5 text-sm text-red-700" role="alert">{error.message}</Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <CommunityNavigation />
      <CommunityPageHeader
        eyebrow="Your community"
        title="My community activity"
        description="Review community updates and manage your safety and profile settings."
      />
      <CommunityFeedback notice={params.notice} error={params.error} />
      <div className="mb-5 flex flex-wrap gap-3">
        <Link href="/dashboard/community/profile" className="rounded-xl border border-[#DDD8EF] bg-white px-4 py-2 text-sm font-semibold text-[#35216B]">Community profile settings</Link>
        <Link href="/dashboard/community" className="rounded-xl border border-[#DDD8EF] bg-white px-4 py-2 text-sm font-semibold text-[#35216B]">Community feed</Link>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-[#35216B]">Notifications</h2>
              <p className="mt-1 text-sm text-[#77758A]">Only you can see these updates.</p>
            </div>
            {!features.community_notifications_enabled && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Notifications are turned off</span>
            )}
          </div>
          {features.community_notifications_enabled ? notifications.length ? (
            <ul className="mt-5 divide-y divide-[#ECEAF5]">
              {notifications.map((notification) => (
                <li key={notification.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <p className={`text-sm ${notification.read_at ? "text-[#77758A]" : "font-semibold text-[#35216B]"}`}>
                      <strong>{notification.actorName}</strong> {notificationLabels[notification.event_type] ?? "sent you a community update"}.
                    </p>
                    <time className="mt-1 block text-xs text-[#77758A]">{new Date(notification.created_at).toLocaleString()}</time>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href={notificationHref(notification.target_type, notification.target_id)} className="text-xs font-semibold text-[#7655D9] hover:underline">Open</Link>
                    {!notification.read_at && (
                      <form action={markCommunityNotificationReadAction}>
                        <input type="hidden" name="notificationId" value={notification.id} />
                        <Button type="submit" size="sm" variant="secondary">Mark read</Button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-xl bg-[#F7F7FC] p-5 text-sm text-[#77758A]">You are all caught up. New community updates will appear here.</p>
          ) : (
            <p className="mt-5 rounded-xl bg-[#F7F7FC] p-5 text-sm text-[#77758A]">Notifications are temporarily unavailable, but your community safety settings remain accessible.</p>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-xl font-bold text-[#35216B]">Blocked learners</h2>
          <p className="mt-1 text-sm text-[#77758A]">Blocked learners cannot interact with you through community features.</p>
          {blocks.length ? (
            <ul className="mt-4 space-y-3">
              {blocks.map((block) => (
                <li key={block.blocked_id} className="flex items-center justify-between gap-3 rounded-xl bg-[#F7F7FC] p-3">
                  <div>
                    <p className="text-sm font-semibold text-[#35216B]">{block.displayName}</p>
                    <p className="text-xs text-[#77758A]">Blocked {new Date(block.created_at).toLocaleDateString()}</p>
                  </div>
                  <form action={unblockCommunityMemberAction}>
                    <input type="hidden" name="blockedId" value={block.blocked_id} />
                    <Button type="submit" variant="secondary" size="sm">Unblock</Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-[#F7F7FC] p-4 text-sm text-[#77758A]">You have not blocked any learners.</p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
