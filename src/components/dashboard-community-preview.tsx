import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { requireGuestWorkspace } from "@/lib/guest-workspace";
import {
  CommunityDataError,
  loadCommunityFeatures,
  loadCommunityFeed,
} from "@/lib/community/data";

type Supabase = Awaited<ReturnType<typeof requireGuestWorkspace>>["supabase"];

export async function DashboardCommunityPreview({
  supabase,
  userId,
  guestTokenHash,
}: {
  supabase: Supabase;
  userId: string;
  guestTokenHash: string;
}) {
  let features: Awaited<ReturnType<typeof loadCommunityFeatures>>;
  try {
    features = await loadCommunityFeatures();
  } catch (error) {
    if (!(error instanceof CommunityDataError)) throw error;
    return null;
  }

  return (
    <section aria-labelledby="dashboard-community-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="dashboard-kicker">LEARN TOGETHER</p>
          <h2 id="dashboard-community-heading" className="dashboard-heading mt-1 text-xl font-bold">Community</h2>
        </div>
        <Link href="/dashboard/community" className="dashboard-inline-link">Explore community <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
      {!features.community_enabled || !features.community_posts_enabled ? (
        <Card className="dashboard-panel flex items-center gap-3 p-5" role="status">
          <span className="dashboard-list-icon"><MessageCircle size={18} aria-hidden="true" /></span>
          <p className="dashboard-muted text-sm">Community discussions are not available right now.</p>
        </Card>
      ) : (
        <CommunityPosts
          supabase={supabase}
          userId={userId}
          guestTokenHash={guestTokenHash}
        />
      )}
    </section>
  );
}

async function CommunityPosts({
  supabase,
  userId,
  guestTokenHash,
}: {
  supabase: Supabase;
  userId: string;
  guestTokenHash: string;
}) {
  let posts: Awaited<ReturnType<typeof loadCommunityFeed>>["posts"] = [];
  let unavailable = false;
  try {
    const feed = await loadCommunityFeed(supabase, userId, guestTokenHash, 1);
    posts = feed.posts.slice(0, 2);
  } catch (error) {
    if (!(error instanceof CommunityDataError)) throw error;
    unavailable = true;
  }

  if (unavailable) {
    return (
      <Card className="dashboard-panel p-5 text-sm" role="status">
        Community activity could not be loaded right now. You can still try the community page.
      </Card>
    );
  }
  if (!posts.length) {
    return (
      <Card className="dashboard-panel flex items-center gap-3 p-5">
        <span className="dashboard-list-icon"><MessageCircle size={18} aria-hidden="true" /></span>
        <p className="dashboard-muted text-sm">No discussions yet. Start a conversation with the learning community.</p>
      </Card>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {posts.map((post) => (
        <Card key={post.id} className="dashboard-panel p-5">
          <p className="dashboard-kicker">{post.post_type.replaceAll("_", " ")}</p>
          <p className="dashboard-heading mt-2 line-clamp-3 text-sm leading-6">{post.body}</p>
          <div className="dashboard-muted mt-4 flex items-center justify-between gap-3 text-xs">
            <span>{post.author.displayName} · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(post.created_at))}</span>
            <Link href={`/dashboard/community#post-${post.id}`} className="dashboard-inline-link shrink-0">Open <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
        </Card>
      ))}
    </div>
  );
}
