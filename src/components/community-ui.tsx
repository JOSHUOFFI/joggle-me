import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { blockCommunityMemberAction } from "@/lib/actions/community";

const notices: Record<string, string> = {
  post_created: "Your post has been shared.",
  post_updated: "Your post has been updated.",
  post_deleted: "Your post has been deleted.",
  comment_created: "Your comment has been added.",
  comment_updated: "Your comment has been updated.",
  comment_deleted: "Your comment has been deleted.",
  reaction_saved: "Your reaction has been saved.",
  question_created: "Your question has been posted.",
  question_updated: "Your question has been updated.",
  question_deleted: "Your question has been deleted.",
  answer_created: "Your answer has been posted.",
  answer_updated: "Your answer has been updated.",
  answer_deleted: "Your answer has been deleted.",
  answer_accepted: "The answer has been marked as accepted.",
  group_created: "Your study group is ready.",
  group_updated: "Study group details have been updated.",
  group_deleted: "The study group has been deleted.",
  group_joined: "You joined the study group.",
  group_left: "You left the study group.",
  request_sent: "Your membership request has been sent.",
  request_pending: "Your membership request is awaiting review.",
  already_member: "You are already a member of this group.",
  request_approved: "The membership request has been approved.",
  request_rejected: "The membership request has been declined.",
  profile_updated: "Your community profile has been updated.",
  report_sent: "Thank you. Your report has been sent to the moderation team.",
  member_blocked: "This learner has been blocked.",
  already_blocked: "This learner is already blocked.",
  member_unblocked: "This learner has been unblocked.",
  notification_read: "Notification marked as read.",
  report_resolved: "The report has been reviewed and recorded.",
  participation_suspended: "Community participation has been suspended.",
  participation_restored: "Community participation has been restored.",
};

const errors: Record<string, string> = {
  disabled: "This community feature is currently unavailable.",
  unavailable: "This content is unavailable or you do not have access to it.",
  validation: "Please review the form and remove any email addresses or phone numbers.",
  save: "The change could not be saved. Please try again.",
};

export function CommunityFeedback({
  notice,
  error,
}: {
  notice?: string;
  error?: string;
}) {
  const noticeText = notice ? notices[notice] : null;
  const errorText = error ? errors[error] ?? errors.save : null;
  return (
    <>
      {noticeText && (
        <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          {noticeText}
        </p>
      )}
      {errorText && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {errorText}
        </p>
      )}
    </>
  );
}

export function CommunityDisabled({ feature = "community" }: { feature?: string }) {
  return (
    <Card className="p-8 text-center">
      <h2 className="text-xl font-bold text-[#35216B]">Community is currently unavailable</h2>
      <p className="mt-2 text-sm text-[#77758A]">
        {feature} features are temporarily turned off. Your account and learning records are not affected.
      </p>
    </Card>
  );
}

export function CommunityAvatar({
  displayName,
  avatarUrl,
}: {
  displayName: string;
  avatarUrl?: string | null;
}) {
  const initials = displayName.trim().slice(0, 1).toUpperCase() || "L";
  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#ECE7FB] text-sm font-bold text-[#35216B]">
      {avatarUrl ? (
        // Avatars are optional HTTPS URLs and stay outside the optimized image proxy.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="size-full object-cover" />
      ) : initials}
    </span>
  );
}

export function CommunityPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-sm font-bold text-[#7655D9]">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-black text-[#17152A]">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#77758A]">{description}</p>
    </div>
  );
}

export function CommunityNavigation() {
  const links = [
    ["Feed", "/dashboard/community"],
    ["Questions & answers", "/dashboard/community/questions"],
    ["Study groups", "/dashboard/community/groups"],
    ["My activity", "/dashboard/community/activity"],
  ] as const;
  return (
    <nav aria-label="Community navigation" className="mb-6 flex flex-wrap gap-2">
      {links.map(([label, href]) => (
        <Link key={href} href={href} className="rounded-xl border border-[#DDD8EF] bg-white px-3 py-2 text-sm font-semibold text-[#35216B] hover:bg-[#F7F7FC]">
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function BlockLearnerForm({
  userId,
  returnTo,
}: {
  userId: string;
  returnTo: string;
}) {
  return (
    <form action={blockCommunityMemberAction}>
      <input type="hidden" name="blockedId" value={userId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <ConfirmActionButton
        confirmation="Block this learner? Their community content will be hidden from you."
        className="rounded-lg border border-[#DDD8EF] px-3 py-2 text-xs font-semibold text-[#35216B]"
      >
        Block learner
      </ConfirmActionButton>
    </form>
  );
}
