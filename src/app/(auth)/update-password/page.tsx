import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordResetAction } from "@/lib/actions/auth";
import { getPasswordRecoveryUser, PASSWORD_RECOVERY_COOKIE } from "@/lib/auth/recovery";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient();
  const recoveryUser = await getPasswordRecoveryUser(
    supabase,
    cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value,
  );

  return (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <h1 className="text-3xl font-black">Choose a new password</h1>
      {recoveryUser ? (
        <>
          <p className="mt-2 text-sm text-[#77758A]">Use at least 12 characters with uppercase and lowercase letters, a number, and a symbol.</p>
          {error === "validation" && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              Choose a strong password and make sure both password fields match.
            </p>
          )}
          {error === "update" && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              We couldn’t update your password. Please try again or request a new reset link.
            </p>
          )}
          <form action={passwordResetAction} className="mt-6 space-y-4">
            <div><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required /></div>
            <div><Label htmlFor="confirmPassword">Confirm password</Label><Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required /></div>
            <Button type="submit" className="w-full" size="lg">Update password</Button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700" role="alert">
            This password reset link is invalid, expired, or has already been used. Request a new link to continue.
          </p>
          <p className="mt-6 text-center">
            <Link className="text-sm font-bold text-[#7655D9]" href="/reset-password">Request a new reset link</Link>
          </p>
        </>
      )}
    </Card>
  );
}
