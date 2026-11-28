import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import {
  CommunityAvatar,
  CommunityDisabled,
  CommunityFeedback,
  CommunityNavigation,
  CommunityPageHeader,
} from "@/components/community-ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireGuestWorkspace } from "@/lib/guest-workspace";
import {
  CommunityDataError,
  loadCommunityFeatures,
  loadCommunityFeed,
} from "@/lib/community/data";
import {
  createCommunityCommentAction,
  createCommunityPostAction,
  deleteCommunityCommentAction,
  deleteCommunityPostAction,
  editCommunityCommentAction,
  editCommunityPostAction,
  reportCommunityContentAction,
  toggleCommunityReactionAction,
  blockCommunityMemberAction,
} from "@/lib/actions/community";

type SearchParams = Promise<{
  page?: string;
  notice?: string;
  error?: string;
}>;

export default async function CommunityFeedPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase, user } = await requireGuestWorkspace();
  const [features, params] = await Promise.all([
    loadCommunityFeatures(),
    searchParams,
  ]);
  return (
    <AppShell>
      <CommunityNavigation />
      <CommunityPageHeader
        eyebrow="Learn together"
        title="Community feed"
        description="Share study tips, ask for support, and celebrate learning progress. Keep posts academic and do not share contact information."
      />
      <CommunityFeedback notice={params.notice} error={params.error} />
      {!features.community_enabled || !features.community_posts_enabled ? (
        <CommunityDisabled feature="Community posts" />
      ) : (
        <FeedContent
          supabase={supabase}
          userId={user.id}
          guestTokenHash={user.guestTokenHash}
          page={params.page}
        />
      )}
    </AppShell>
  );
}

async function FeedContent({
  supabase,
  userId,
  guestTokenHash,
  page,
}: {
  supabase: Awaited<ReturnType<typeof requireGuestWorkspace>>["supabase"];
  userId: string;
  guestTokenHash: string;
  page?: string;
}) {
  const pageNumber = Number(page ?? 1);
  const safePage = Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  let feed: Awaited<ReturnType<typeof loadCommunityFeed>>;
  try {
    feed = await loadCommunityFeed(supabase, userId, guestTokenHash, safePage);
  } catch (error) {
    if (!(error instanceof CommunityDataError)) throw error;
    return <Card className="p-5 text-sm text-red-700" role="alert">{error.message}</Card>;
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(270px,.7fr)]">
      <div className="space-y-4">
        {feed.posts.length ? feed.posts.map((post) => (
          <Card key={post.id} id={`post-${post.id}`} className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <CommunityAvatar displayName={post.author.displayName} avatarUrl={post.author.avatarUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-[#35216B]">
                      {post.author.profileHref
                        ? <Link href={post.author.profileHref} className="hover:underline">{post.author.displayName}</Link>
                        : post.author.displayName}
                    </p>
                    <p className="text-xs text-[#77758A]">
                      {post.post_type.replaceAll("_", " ")} · {new Date(post.created_at).toLocaleString()}
                    </p>
                  </div>
                  {post.group_id && (
                    <Link className="text-sm font-semibold text-[#7655D9] hover:underline" href={`/dashboard/community/groups/${post.group_id}`}>
                      Study group
                    </Link>
                  )}
                </div>
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-[#343247]">{post.body}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#ECEAF5] pt-3">
                  <form action={toggleCommunityReactionAction}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="reactionType" value="like" />
                    <input type="hidden" name="returnTo" value="/dashboard/community" />
                    <Button type="submit" variant="ghost" size="sm">
                      {post.stats.reacted_by_me ? "Unlike" : "Like"} · {post.stats.reaction_count}
                    </Button>
                  </form>
                  <span className="text-xs text-[#77758A]">{post.stats.comment_count} comments</span>
                  {post.author_id !== userId && (
                    <details className="ml-auto">
                      <summary className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-[#77758A]">Safety</summary>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <form action={blockCommunityMemberAction}>
                          <input type="hidden" name="blockedId" value={post.author_id} />
                          <input type="hidden" name="returnTo" value="/dashboard/community" />
                          <ConfirmActionButton confirmation="Block this learner? Their community content will be hidden from you." className="rounded-lg border border-[#DDD8EF] px-3 py-2 text-xs font-semibold text-[#35216B]">
                            Block learner
                          </ConfirmActionButton>
                        </form>
                        <ReportForm targetType="post" targetId={post.id} />
                      </div>
                    </details>
                  )}
                </div>

                {post.author_id === userId && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <details>
                      <summary className="cursor-pointer px-2 py-1 text-xs font-semibold text-[#7655D9]">Edit post</summary>
                      <form action={editCommunityPostAction} className="mt-2 space-y-2">
                        <input type="hidden" name="postId" value={post.id} />
                        <input type="hidden" name="returnTo" value="/dashboard/community" />
                        <textarea name="body" defaultValue={post.body} maxLength={3000} required className="min-h-24 w-full rounded-xl border border-[#DDD8EF] p-3 text-sm" />
                        <Button type="submit" size="sm">Save post</Button>
                      </form>
                    </details>
                    <form action={deleteCommunityPostAction}>
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="returnTo" value="/dashboard/community" />
                      <ConfirmActionButton confirmation="Delete this post and its comments?" className="rounded-lg px-2 py-1 text-xs font-semibold text-red-700">
                        Delete post
                      </ConfirmActionButton>
                    </form>
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {post.comments.map((comment) => (
                    <div key={comment.id} id={`comment-${comment.id}`} className="rounded-xl bg-[#F7F7FC] p-3">
                      <div className="flex items-center gap-2">
                        <CommunityAvatar displayName={comment.author.displayName} avatarUrl={comment.author.avatarUrl} />
                        <p className="text-sm font-semibold text-[#35216B]">
                          {comment.author.profileHref
                            ? <Link href={comment.author.profileHref} className="hover:underline">{comment.author.displayName}</Link>
                            : comment.author.displayName}
                        </p>
                        <time className="ml-auto text-[11px] text-[#77758A]">{new Date(comment.created_at).toLocaleDateString()}</time>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-5 text-[#343247]">{comment.body}</p>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {comment.parent_comment_id === null && (
                          <details>
                            <summary className="cursor-pointer text-xs font-semibold text-[#7655D9]">Reply</summary>
                            <form action={createCommunityCommentAction} className="mt-2 flex flex-col gap-2">
                              <input type="hidden" name="parentCommentId" value={comment.id} />
                              <input type="hidden" name="postId" value={post.id} />
                              <input type="hidden" name="returnTo" value="/dashboard/community" />
                              <textarea name="body" maxLength={1500} required placeholder="Write an academic reply" className="min-h-16 rounded-lg border border-[#DDD8EF] p-2 text-sm" />
                              <Button type="submit" size="sm">Reply</Button>
                            </form>
                          </details>
                        )}
                        {comment.author_id === userId ? (
                          <>
                            <details>
                              <summary className="cursor-pointer text-xs font-semibold text-[#7655D9]">Edit</summary>
                              <form action={editCommunityCommentAction} className="mt-2 space-y-2">
                                <input type="hidden" name="commentId" value={comment.id} />
                                <input type="hidden" name="returnTo" value="/dashboard/community" />
                                <textarea name="body" defaultValue={comment.body} maxLength={1500} required className="min-h-16 w-full rounded-lg border border-[#DDD8EF] p-2 text-sm" />
                                <Button type="submit" size="sm">Save</Button>
                              </form>
                            </details>
                            <form action={deleteCommunityCommentAction}>
                              <input type="hidden" name="commentId" value={comment.id} />
                              <input type="hidden" name="returnTo" value="/dashboard/community" />
                              <ConfirmActionButton confirmation="Delete this comment and any replies?" className="text-xs font-semibold text-red-700">Delete</ConfirmActionButton>
                            </form>
                          </>
                        ) : (
                          <ReportForm targetType="comment" targetId={comment.id} compact />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <form action={createCommunityCommentAction} className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="returnTo" value="/dashboard/community" />
                  <input name="body" maxLength={1500} required placeholder="Add an academic comment" className="h-11 min-w-0 flex-1 rounded-xl border border-[#DDD8EF] px-3 text-sm" />
                  <Button type="submit" variant="secondary">Comment</Button>
                </form>
              </div>
            </div>
          </Card>
        )) : (
          <Card className="p-8 text-center">
            <h2 className="font-bold text-[#35216B]">Start the conversation</h2>
            <p className="mt-2 text-sm text-[#77758A]">There are no posts on this page yet. Share a study tip or ask your community for help.</p>
          </Card>
        )}
        <div className="flex justify-between">
          {feed.page > 1 ? <Link className="rounded-xl border border-[#DDD8EF] px-4 py-2 text-sm font-semibold text-[#35216B]" href={`?page=${feed.page - 1}`}>Newer posts</Link> : <span />}
          {feed.hasMore && <Link className="rounded-xl border border-[#DDD8EF] px-4 py-2 text-sm font-semibold text-[#35216B]" href={`?page=${feed.page + 1}`}>Older posts</Link>}
        </div>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-[#35216B]">Share with the community</h2>
        <p className="mt-1 text-sm text-[#77758A]">Keep it helpful, kind, and focused on learning.</p>
        <form action={createCommunityPostAction} className="mt-4 space-y-3">
          <input type="hidden" name="returnTo" value="/dashboard/community" />
          <label htmlFor="postType" className="block text-sm font-semibold">Post type</label>
          <select id="postType" name="postType" className="h-11 w-full rounded-xl border border-[#DDD8EF] bg-white px-3 text-sm">
            <option value="discussion">Discussion</option>
            <option value="study_tip">Study tip</option>
            <option value="achievement">Learning achievement</option>
          </select>
          <label htmlFor="postBody" className="block text-sm font-semibold">Your post</label>
          <textarea id="postBody" name="body" maxLength={3000} required placeholder="What are you learning?" className="min-h-32 w-full rounded-xl border border-[#DDD8EF] p-3 text-sm" />
          <p className="text-xs text-[#77758A]">Do not include email addresses, phone numbers, or private information.</p>
          <Button type="submit" className="w-full">Share post</Button>
        </form>
      </Card>
    </div>
  );
}

function ReportForm({
  targetType,
  targetId,
  compact = false,
}: {
  targetType: "post" | "comment";
  targetId: string;
  compact?: boolean;
}) {
  return (
    <details>
      <summary className="cursor-pointer text-xs font-semibold text-[#77758A]">Report</summary>
      <form action={reportCommunityContentAction} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="returnTo" value="/dashboard/community" />
        <textarea name="reason" maxLength={500} required placeholder="Briefly describe the concern" className={`${compact ? "min-h-16" : "min-h-20"} rounded-lg border border-[#DDD8EF] p-2 text-sm`} />
        <Button type="submit" variant="secondary" size="sm">Send report</Button>
      </form>
    </details>
  );
}
