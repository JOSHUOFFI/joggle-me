import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "@/lib/actions/auth";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message =
    error === "exists"
      ? "An account already exists for that email."
      : error === "validation"
        ? "Please check the form details."
        : error === "registration_disabled"
          ? "User registration is currently disabled."
          : error
            ? "We could not create your account."
            : null;
  return (
    <Card className="w-full max-w-lg p-6 sm:p-8">
      <h1 className="text-3xl font-black">Create your account</h1>
      <p className="mt-2 text-sm text-[#77758A]">Start learning with JOGGLE ME.</p>
      {message && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{message}</p>}
      <form action={registerAction} className="mt-6 grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="firstName">First name</Label><Input id="firstName" name="firstName" autoComplete="given-name" required /></div>
        <div><Label htmlFor="lastName">Last name</Label><Input id="lastName" name="lastName" autoComplete="family-name" required /></div>
        <div className="sm:col-span-2"><Label htmlFor="username">Username</Label><Input id="username" name="username" autoComplete="username" required pattern="[A-Za-z0-9._\x2d]{3,30}" /></div>
        <div className="sm:col-span-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required /></div>
        <div><Label htmlFor="confirmPassword">Confirm password</Label><Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required /></div>
        <div className="sm:col-span-2"><Button type="submit" className="w-full" size="lg">Create account</Button></div>
      </form>
      <p className="mt-6 text-center text-sm text-[#77758A]">Already have an account? <Link className="font-bold text-[#7655D9]" href="/login">Log in</Link></p>
    </Card>
  );
}
