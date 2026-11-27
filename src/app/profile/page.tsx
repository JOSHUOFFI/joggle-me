import { requireAuthenticatedUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProfileAction, requestEmailChangeAction } from "@/lib/actions/profile";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; email_verification?: string }>;
}) {
  const { supabase, user } = await requireAuthenticatedUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const params = await searchParams;

  return (
    <AppShell>
      <div className="mb-6"><p className="text-sm font-bold text-[#7655D9]">Account settings</p><h1 className="mt-1 text-3xl font-black">Profile</h1></div>
      {params.saved && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Profile updated.</p>}
      {params.email_verification && <p className="mb-4 rounded-xl bg-[#27B9D6]/10 px-4 py-3 text-sm text-[#176D80]">Check both email inboxes to confirm your email change.</p>}
      {params.error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">The update could not be saved. Please check the values.</p>}
      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <Card className="p-5 sm:p-7">
          <h2 className="text-xl font-bold">Personal information</h2>
          <form action={updateProfileAction} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="firstName">First name</Label><Input id="firstName" name="firstName" defaultValue={profile?.first_name ?? ""} required /></div>
            <div><Label htmlFor="lastName">Last name</Label><Input id="lastName" name="lastName" defaultValue={profile?.last_name ?? ""} required /></div>
            <div><Label htmlFor="username">Username</Label><Input id="username" name="username" defaultValue={profile?.username ?? ""} pattern="[A-Za-z0-9._\x2d]{3,30}" required /></div>
            <div><Label htmlFor="phoneNumber">Phone number</Label><Input id="phoneNumber" name="phoneNumber" type="tel" defaultValue={profile?.phone_number ?? ""} /></div>
            <div><Label htmlFor="learnerCategory">Learner category</Label>
              <select id="learnerCategory" name="learnerCategory" defaultValue={profile?.learner_category ?? "independent"} className="h-11 w-full rounded-xl border border-[#DDD8EF] bg-white px-3 text-sm">
                <option value="secondary_school">Secondary school student</option>
                <option value="university">University student</option>
                <option value="independent">Independent learner</option>
              </select>
            </div>
            <div><Label htmlFor="institution">Institution</Label><Input id="institution" name="institution" defaultValue={profile?.institution ?? ""} /></div>
            <div className="sm:col-span-2"><Label htmlFor="profileImageUrl">Profile image URL</Label><Input id="profileImageUrl" name="profileImageUrl" type="url" defaultValue={profile?.profile_image_url ?? ""} /></div>
            <div className="sm:col-span-2"><Button type="submit">Save profile</Button></div>
          </form>
        </Card>
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-bold">Email address</h2>
            <p className="mt-1 text-sm text-[#77758A]">Email changes require verification.</p>
            <form action={requestEmailChangeAction} className="mt-4 space-y-3">
              <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={user.email ?? ""} required /></div>
              <Button type="submit" variant="secondary" className="w-full">Request email change</Button>
            </form>
          </Card>
          <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-bold">Account activity</h2>
            <dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-[#77758A]">Created</dt><dd>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "Unavailable"}</dd></div><div className="flex justify-between gap-4"><dt className="text-[#77758A]">Updated</dt><dd>{profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString() : "Unavailable"}</dd></div></dl>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
