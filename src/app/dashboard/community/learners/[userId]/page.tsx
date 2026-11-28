import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CommunityAvatar, CommunityDisabled, CommunityNavigation, CommunityPageHeader } from "@/components/community-ui";
import { Card } from "@/components/ui/card";
import { requireGuestWorkspace } from "@/lib/guest-workspace";
import {
  CommunityDataError,
  loadCommunityFeatures,
  loadPublicCommunityProfile,
} from "@/lib/community/data";
import { uuidSchema } from "@/lib/community/validation";

const badgeTitles: Record<string, string> = {
  first_steps: "First Steps",
  quiz_champion: "Quiz Champion",
  consistent_learner: "Consistent Learner",
  perfect_score: "Perfect Score",
  dedicated_learner: "Dedicated Learner",
  knowledge_seeker: "Knowledge Seeker",
};

export default async function PublicCommunityProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { supabase, user } = await requireGuestWorkspace();
  const [{ userId }, features] = await Promise.all([params, loadCommunityFeatures()]);
  if (!uuidSchema.safeParse(userId).success) notFound();

  if (!features.community_enabled) {
    return <AppShell><CommunityNavigation /><CommunityDisabled /></AppShell>;
  }
  let profile: Awaited<ReturnType<typeof loadPublicCommunityProfile>>;
  try {
    profile = await loadPublicCommunityProfile(
      supabase,
      user.id,
      user.guestTokenHash,
      userId,
    );
  } catch (error) {
    if (!(error instanceof CommunityDataError)) throw error;
    return (
      <AppShell>
        <CommunityNavigation />
        <CommunityPageHeader eyebrow="Community member" title="Profile unavailable" description="Community profile data could not be loaded." />
        <Card className="p-5 text-sm text-red-700" role="alert">{error.message}</Card>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell>
        <CommunityNavigation />
        <CommunityPageHeader eyebrow="Community member" title="Profile unavailable" description="This learner has not made a community profile visible." />
        <Link href="/dashboard/community" className="text-sm font-semibold text-[#7655D9] hover:underline">Return to the community feed</Link>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <CommunityNavigation />
      <div className="mb-5">
        <Link href="/dashboard/community" className="text-sm font-semibold text-[#7655D9] hover:underline">← Community feed</Link>
      </div>
      <Card className="max-w-3xl p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <CommunityAvatar displayName={profile.display_name} avatarUrl={profile.avatar_url} />
          <div>
            <p className="text-sm font-bold text-[#7655D9]">Community member</p>
            <h1 className="text-2xl font-black text-[#35216B]">{profile.display_name}</h1>
          </div>
        </div>
        {profile.biography && <p className="mt-6 whitespace-pre-wrap text-sm leading-6 text-[#343247]">{profile.biography}</p>}
        {profile.learning_interests.length > 0 && (
          <section className="mt-6">
            <h2 className="font-bold text-[#35216B]">Learning interests</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.learning_interests.map((interest) => <span key={interest} className="rounded-full bg-[#ECE7FB] px-3 py-1 text-xs font-semibold text-[#35216B]">{interest}</span>)}
            </div>
          </section>
        )}
        {profile.subjects.length > 0 && (
          <section className="mt-6">
            <h2 className="font-bold text-[#35216B]">Subjects</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.subjects.map((subject) => <span key={subject} className="rounded-full bg-[#F7F7FC] px-3 py-1 text-xs font-semibold text-[#35216B]">{subject}</span>)}
            </div>
          </section>
        )}
        {profile.show_achievements && (
          <section className="mt-6">
            <h2 className="font-bold text-[#35216B]">Shared achievements</h2>
            {profile.badges.length ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {profile.badges.map((badge) => (
                  <li key={`${badge.badge_key}-${badge.awarded_at}`} className="rounded-xl border border-[#ECEAF5] p-3">
                    <p className="font-semibold text-[#35216B]">{badgeTitles[badge.badge_key]}</p>
                    <p className="mt-1 text-xs text-[#77758A]">Earned {new Date(badge.awarded_at).toLocaleDateString()}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[#77758A]">No badges have been shared yet.</p>
            )}
          </section>
        )}
        <p className="mt-8 border-t border-[#ECEAF5] pt-4 text-xs leading-5 text-[#77758A]">
          JOGGLE ME never displays this learner&apos;s email address, phone number, institution, quiz scores, or private account details.
        </p>
      </Card>
    </AppShell>
  );
}
