import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetRequestAction } from "@/lib/actions/auth";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  return (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <h1 className="text-3xl font-black">Reset password</h1>
      <p className="mt-2 text-sm text-[#77758A]">Enter the email address associated with your account.</p>
      {sent ? (
        <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm leading-6 text-green-800" role="status">
          If that email is registered, you’ll receive a password reset link shortly.
        </p>
      ) : (
        <>
          {error === "validation" && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              Enter a valid email address.
            </p>
          )}
          <form action={resetRequestAction} className="mt-6 space-y-4">
            <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
            <Button type="submit" className="w-full" size="lg">Send reset link</Button>
          </form>
        </>
      )}
      <p className="mt-6 text-center"><Link className="text-sm font-bold text-[#7655D9]" href="/login">Back to login</Link></p>
    </Card>
  );
}
