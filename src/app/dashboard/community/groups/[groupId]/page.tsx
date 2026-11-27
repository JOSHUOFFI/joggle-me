import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import {
  CommunityAvatar,
  CommunityDisabled,
  CommunityFeedback,
  CommunityNavigation,
  CommunityPageHeader,
  BlockLearnerForm,
} from "@/components/community-ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import {
  CommunityDataError,
  loadCommunityFeatures,
  loadCommunityFeed,
  loadStudyGroupDetail,
} from "@/lib/community/data";
import { uuidSchema } from "@/lib/community/validation";
import {
  createCommunityCommentAction,
  createCommunityPostAction,
  deleteCommunityCommentAction,
  editCommunityCommentAction,
  deleteStudyGroupAction,
  deleteCommunityPostAction,
  editCommunityPostAction,
  joinStudyGroupAction,
  leaveStudyGroupAction,
  reportCommunityContentAction,
  reviewGroupRequestAction,
  toggleCommunityReactionAction,
  updateStudyGroupAction,
} from "@/lib/actions/community";

type Props = {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

export default async function StudyGroupDetailPage({ params, searchParams }: Props) {
  const { supabase, user } = await requireRole(["learner"]);
  const [{ groupId }, query, features] = await Promise.all([
    params,
    searchParams,
    loadCommunityFeatures(supabase),
  ]);
  if (!uuidSchema.safeParse(groupId).success) notFound();

  return (
    <AppShell>
      <CommunityNavigation />
      <CommunityFeedback notice={query.notice} error={query.error} />
      {!features.community_enabled || !features.study_groups_enabled ? (
        <CommunityDisabled feature="Study groups" />
      ) : (
        <GroupContent
          supabase={supabase}
          userId={user.id}
          groupId={groupId}
          postsEnabled={features.community_posts_enabled}
        />
      )}
    </AppShell>
  );
}

async function GroupContent({
  supabase,
  userId,
  groupId,
  postsEnabled,
}: {
  supabase: Awaited<ReturnType<typeof requireRole>>["supabase"];
  userId: string;
  groupId: string;
  postsEnabled: boolean;
}) {
  let detail: Awaited<ReturnType<typeof loadStudyGroupDetail>>;
  let feed: Awaited<ReturnType<typeof loadCommunityFeed>>;
  try {
    [detail, feed] = await Promise.all([
      loadStudyGroupDetail(supabase, userId, groupId),
      loadCommunityFeed(supabase, userId, 1, groupId),
    ]);
  } catch (error) {
    if (!(error instanceof CommunityDataError)) throw error;
    return <Card className="p-5 text-sm text-red-700" role="alert">{error.message}</Card>;
  }
  if (!detail) {
    return (
      <Card className="p-8 text-center">
        <h1 className="text-xl font-bold text-[#35216B]">Study group unavailable</h1>
        <p className="mt-2 text-sm text-[#77758A]">This group may have been removed or may not be visible to you.</p>
        <Link href="/dashboard/community/groups" className="mt-4 inline-block text-sm font-semibold text-[#7655D9]">Back to study groups</Link>
      </Card>
    );
  }
  const returnTo = `/dashboard/community/groups/${groupId}`;
  const isMember = detail.stats.my_status === "active";
  const canAdminister = detail.stats.is_admin;
  const requests = detail.requests.filter((member) => member.status === "pending");

  return (
    <>
      <div className="mb-5">
        <Link href="/dashboard/community/groups" className="text-sm font-semibold text-[#7655D9] hover:underline">← Study groups</Link>
      </div>
      <CommunityPageHeader
        eyebrow={`${detail.group.subject} · ${detail.group.visibility} group`}
        title={detail.group.name}
        description={detail.group.description}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
        <div className="space-y-4">
          {isMember && postsEnabled && (
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-bold text-[#35216B]">Start a group discussion</h2>
              <form action={createCommunityPostAction} className="mt-3 space-y-3">
                <input type="hidden" name="groupId" value={groupId} />
                <input type="hidden" name="postType" value="discussion" />
                <input type="hidden" name="returnTo" value={returnTo} />
                <textarea name="body" maxLength={3000} required placeholder="Share a question, study plan, or useful idea." className="min-h-24 w-full rounded-xl border border-[#DDD8EF] p-3 text-sm" />
                <Button type="submit">Post discussion</Button>
              </form>
            </Card>
          )}
          {isMember ? !postsEnabled ? (
            <Card className="p-7 text-sm text-[#77758A]">Group discussions are temporarily turned off.</Card>
          ) : feed.posts.length ? feed.posts.map((post) => (
            <Card key={post.id} id={`post-${post.id}`} className="p-5">
              <div className="flex items-center gap-3">
                <CommunityAvatar displayName={post.author.displayName} avatarUrl={post.author.avatarUrl} />
                <div>
                  <p className="font-bold text-[#35216B]">
                    {post.author.profileHref
                      ? <Link href={post.author.profileHref} className="hover:underline">{post.author.displayName}</Link>
                      : post.author.displayName}
                  </p>
                  <p className="text-xs text-[#77758A]">{new Date(post.created_at).toLocaleString()}</p>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6">{post.body}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <form action={toggleCommunityReactionAction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="reactionType" value="like" />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <Button type="submit" variant="ghost" size="sm">
                    {post.stats.reacted_by_me ? "Unlike" : "Like"} · {post.stats.reaction_count}
                  </Button>
                </form>
                {post.author_id !== userId && (
                  <>
                    <BlockLearnerForm userId={post.author_id} returnTo={returnTo} />
                    <ReportForm targetType="post" targetId={post.id} returnTo={returnTo} />
                  </>
                )}
              </div>
              {post.author_id === userId && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold text-[#7655D9]">Edit</summary>
                    <form action={editCommunityPostAction} className="mt-2 space-y-2">
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <textarea name="body" defaultValue={post.body} maxLength={3000} required className="min-h-20 w-full rounded-lg border border-[#DDD8EF] p-2 text-sm" />
                      <Button type="submit" size="sm">Save</Button>
                    </form>
                  </details>
                  <form action={deleteCommunityPostAction}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <ConfirmActionButton confirmation="Delete this discussion and its comments?" className="text-xs font-semibold text-red-700">Delete</ConfirmActionButton>
                  </form>
                </div>
              )}
              <div className="mt-4 space-y-3 border-t border-[#ECEAF5] pt-3">
                {post.comments.map((comment) => (
                  <div key={comment.id} id={`comment-${comment.id}`} className="rounded-lg bg-[#F7F7FC] p-3">
                    <p className="text-xs font-semibold text-[#35216B]">
                      {comment.author.profileHref
                        ? <Link href={comment.author.profileHref} className="hover:underline">{comment.author.displayName}</Link>
                        : comment.author.displayName}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm">{comment.body}</p>
                    {comment.author_id === userId && (
                      <div className="mt-2 flex flex-wrap gap-3">
                        <details>
                          <summary className="cursor-pointer text-xs font-semibold text-[#7655D9]">Edit</summary>
                          <form action={editCommunityCommentAction} className="mt-2 space-y-2">
                            <input type="hidden" name="commentId" value={comment.id} />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <textarea name="body" defaultValue={comment.body} maxLength={1500} required className="min-h-16 w-full rounded-lg border border-[#DDD8EF] p-2 text-sm" />
                            <Button type="submit" size="sm">Save</Button>
                          </form>
                        </details>
                        <form action={deleteCommunityCommentAction}>
                          <input type="hidden" name="commentId" value={comment.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <ConfirmActionButton confirmation="Delete this comment and any replies?" className="text-xs font-semibold text-red-700">Delete comment</ConfirmActionButton>
                        </form>
                      </div>
                    )}
                    {comment.author_id !== userId && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <BlockLearnerForm userId={comment.author_id} returnTo={returnTo} />
                        <ReportForm targetType="comment" targetId={comment.id} returnTo={returnTo} />
                      </div>
                    )}
                    {comment.parent_comment_id === null && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-[#7655D9]">Reply</summary>
                        <form action={createCommunityCommentAction} className="mt-2 space-y-2">
                          <input type="hidden" name="parentCommentId" value={comment.id} />
                          <input type="hidden" name="postId" value={post.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <textarea name="body" maxLength={1500} required placeholder="Write an academic reply" className="min-h-16 w-full rounded-lg border border-[#DDD8EF] p-2 text-sm" />
                          <Button type="submit" size="sm">Reply</Button>
                        </form>
                      </details>
                    )}
                  </div>
                ))}
                <form action={createCommunityCommentAction} className="flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input name="body" maxLength={1500} required placeholder="Add to the discussion" className="h-10 min-w-0 flex-1 rounded-lg border border-[#DDD8EF] px-3 text-sm" />
                  <Button type="submit" variant="secondary" size="sm">Comment</Button>
                </form>
              </div>
            </Card>
          )) : (
            <Card className="p-7 text-center text-sm text-[#77758A]">No discussions yet. Start the first conversation.</Card>
          ) : (
            <Card className="p-7">
              <p className="text-sm text-[#77758A]">
                {detail.stats.my_status === "pending"
                  ? "Your request to join this private group is awaiting an administrator."
                  : "Join this group to view and participate in its discussions."}
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="font-bold text-[#35216B]">Group details</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-[#77758A]">Members</dt><dd>{detail.stats.member_count}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#77758A]">Visibility</dt><dd className="capitalize">{detail.group.visibility}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#77758A]">Created</dt><dd>{new Date(detail.group.created_at).toLocaleDateString()}</dd></div>
            </dl>
            {!isMember && (
              <form action={joinStudyGroupAction} className="mt-4">
                <input type="hidden" name="groupId" value={groupId} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <Button type="submit" className="w-full" variant="secondary">
                  {detail.group.visibility === "public" ? "Join group" : "Request to join"}
                </Button>
              </form>
            )}
            {isMember && !canAdminister && (
              <form action={leaveStudyGroupAction} className="mt-4">
                <input type="hidden" name="groupId" value={groupId} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <ConfirmActionButton confirmation="Leave this study group? You can request to join it again." className="w-full rounded-xl border border-[#DDD8EF] px-4 py-2 text-sm font-semibold text-[#35216B]">
                  Leave group
                </ConfirmActionButton>
              </form>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-[#35216B]">Members</h2>
            <ul className="mt-3 space-y-2">
              {detail.members.map((member, index) => (
                <li key={`${member.userId}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {member.profileHref
                      ? <Link href={member.profileHref} className="hover:underline">{member.displayName}</Link>
                      : member.displayName}
                  </span>
                  {member.role === "admin" && <span className="rounded-full bg-[#ECE7FB] px-2 py-1 text-[11px] font-semibold text-[#35216B]">Admin</span>}
                </li>
              ))}
            </ul>
          </Card>

          {canAdminister && (
            <>
              <Card className="p-5">
                <h2 className="font-bold text-[#35216B]">Manage group</h2>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-[#7655D9]">Edit group details</summary>
                  <form action={updateStudyGroupAction} className="mt-3 space-y-3">
                    <input type="hidden" name="groupId" value={groupId} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label className="block text-xs font-semibold">Name<input name="name" defaultValue={detail.group.name} maxLength={80} required className="mt-1 h-10 w-full rounded-lg border border-[#DDD8EF] px-3 text-sm" /></label>
                    <label className="block text-xs font-semibold">Subject<input name="subject" defaultValue={detail.group.subject} maxLength={80} required className="mt-1 h-10 w-full rounded-lg border border-[#DDD8EF] px-3 text-sm" /></label>
                    <label className="block text-xs font-semibold">Description<textarea name="description" defaultValue={detail.group.description} maxLength={1200} required className="mt-1 min-h-20 w-full rounded-lg border border-[#DDD8EF] p-2 text-sm" /></label>
                    <label className="block text-xs font-semibold">Visibility<select name="visibility" defaultValue={detail.group.visibility} className="mt-1 h-10 w-full rounded-lg border border-[#DDD8EF] bg-white px-3 text-sm"><option value="public">Public</option><option value="private">Private</option></select></label>
                    <Button type="submit" size="sm">Save changes</Button>
                  </form>
                </details>
                <form action={deleteStudyGroupAction} className="mt-4">
                  <input type="hidden" name="groupId" value={groupId} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <ConfirmActionButton
                    confirmation="Permanently delete this group and all its discussions?"
                    className="text-sm font-semibold text-red-700"
                  >
                    Delete group
                  </ConfirmActionButton>
                </form>
              </Card>
              {requests.length > 0 && (
                <Card className="p-5">
                  <h2 className="font-bold text-[#35216B]">Membership requests</h2>
                  <ul className="mt-3 space-y-3">
                    {requests.map((member) => (
                      <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm">{member.displayName}</span>
                        <div className="flex gap-2">
                          <RequestDecision id={member.id} approve returnTo={returnTo} />
                          <RequestDecision id={member.id} approve={false} returnTo={returnTo} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function RequestDecision({
  id,
  approve,
  returnTo,
}: {
  id: string;
  approve: boolean;
  returnTo: string;
}) {
  return (
    <form action={reviewGroupRequestAction}>
      <input type="hidden" name="membershipId" value={id} />
      <input type="hidden" name="approve" value={approve ? "true" : "false"} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Button type="submit" size="sm" variant={approve ? "primary" : "secondary"}>{approve ? "Approve" : "Decline"}</Button>
    </form>
  );
}

function ReportForm({
  targetType,
  targetId,
  returnTo,
}: {
  targetType: "comment" | "post";
  targetId: string;
  returnTo: string;
}) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-semibold text-[#77758A]">Report comment</summary>
      <form action={reportCommunityContentAction} className="mt-2 space-y-2">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <textarea name="reason" maxLength={500} required placeholder="Briefly describe the concern" className="min-h-16 w-full rounded-lg border border-[#DDD8EF] p-2 text-sm" />
        <Button type="submit" variant="secondary" size="sm">Send report</Button>
      </form>
    </details>
  );
}
