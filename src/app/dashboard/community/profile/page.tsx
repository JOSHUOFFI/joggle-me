import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CommunityDisabled, CommunityFeedback, CommunityNavigation, CommunityPageHeader } from "@/components/community-ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireGuestWorkspace } from "@/lib/guest-workspace";
import {
  CommunityDataError,
  loadCommunityFeatures,
  loadOwnCommunityProfile,
} from "@/lib/community/data";
import { updateCommunityProfileAction } from "@/lib/actions/community";

type SearchParams = Promise<{ notice?: string; error?: string }>;

export default async function CommunityProfileSettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase, user } = await requireGuestWorkspace();
  const [features, params] = await Promise.all([
    loadCommunityFeatures(),
    searchParams,
  ]);
  let profile: Awaited<ReturnType<typeof loadOwnCommunityProfile>> = null;
  if (features.community_enabled) {
    try {
      profile = await loadOwnCommunityProfile(supabase, user.id);
    } catch (error) {
      if (!(error instanceof CommunityDataError)) throw error;
      return (
        <AppShell>
          <CommunityNavigation />
          <CommunityPageHeader eyebrow="Your community" title="Profile settings" description="Choose what other learners can see." />
          <Card className="p-5 text-sm text-red-700" role="alert">{error.message}</Card>
        </AppShell>
      );
    }
  }
  return (
    <AppShell>
      <CommunityNavigation />
      <CommunityPageHeader
        eyebrow="Your community"
        title="Profile settings"
        description="Community profiles are optional. Only the information below is shared, and your profile starts private."
      />
      <CommunityFeedback notice={params.notice} error={params.error} />
      {!features.community_enabled ? (
        <CommunityDisabled />
      ) : (
        <Card className="max-w-3xl p-5 sm:p-7">
          <form action={updateCommunityProfileAction} className="space-y-5">
            <div>
              <label htmlFor="communityDisplayName" className="block text-sm font-semibold">Display name</label>
              <input id="communityDisplayName" name="displayName" defaultValue={profile?.display_name ?? "Learner"} maxLength={60} required className="mt-1 h-11 w-full rounded-xl border border-[#DDD8EF] px-3 text-sm" />
            </div>
            <div>
              <label htmlFor="communityAvatar" className="block text-sm font-semibold">Profile image URL (optional)</label>
              <input id="communityAvatar" name="avatarUrl" type="url" defaultValue={profile?.avatar_url ?? ""} maxLength={500} placeholder="https://…" className="mt-1 h-11 w-full rounded-xl border border-[#DDD8EF] px-3 text-sm" />
              <p className="mt-1 text-xs text-[#77758A]">Use an HTTPS image address without private or signed URL parameters.</p>
            </div>
            <div>
              <label htmlFor="communityBio" className="block text-sm font-semibold">Short biography</label>
              <textarea id="communityBio" name="biography" defaultValue={profile?.biography ?? ""} maxLength={300} placeholder="A short, learning-focused introduction" className="mt-1 min-h-24 w-full rounded-xl border border-[#DDD8EF] p-3 text-sm" />
            </div>
            <div>
              <label htmlFor="communityInterests" className="block text-sm font-semibold">Learning interests</label>
              <input id="communityInterests" name="interests" defaultValue={profile?.learning_interests.join(", ") ?? ""} maxLength={450} placeholder="e.g. robotics, reading, problem solving" className="mt-1 h-11 w-full rounded-xl border border-[#DDD8EF] px-3 text-sm" />
              <p className="mt-1 text-xs text-[#77758A]">Separate up to 10 interests with commas.</p>
            </div>
            <div>
              <label htmlFor="communitySubjects" className="block text-sm font-semibold">Subjects of interest</label>
              <input id="communitySubjects" name="subjects" defaultValue={profile?.subjects.join(", ") ?? ""} maxLength={450} placeholder="e.g. Biology, Mathematics" className="mt-1 h-11 w-full rounded-xl border border-[#DDD8EF] px-3 text-sm" />
              <p className="mt-1 text-xs text-[#77758A]">Separate up to 10 subjects with commas.</p>
            </div>
            <div className="space-y-3 rounded-xl bg-[#F7F7FC] p-4">
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="profileVisible" value="true" defaultChecked={profile?.profile_visible ?? false} className="mt-1 size-4 accent-[#7655D9]" />
                <span><strong>Make my community profile visible</strong><span className="mt-1 block text-xs text-[#77758A]">Other learners can see your display name, image, biography, and interests. Email, phone, institution, and account details are never included.</span></span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="showAchievements" value="true" defaultChecked={profile?.show_achievements ?? false} className="mt-1 size-4 accent-[#7655D9]" />
                <span><strong>Share earned badges on my public profile</strong><span className="mt-1 block text-xs text-[#77758A]">Badges are hidden unless you enable this and make your profile visible. Quiz scores and performance history are never shown.</span></span>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit">Save community profile</Button>
              <Link href="/dashboard/community/activity" className="text-sm font-semibold text-[#7655D9] hover:underline">Manage blocked learners</Link>
            </div>
          </form>
        </Card>
      )}
    </AppShell>
  );
}
