import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LoginPasswordField,
  LoginSubmitButton,
} from "@/components/auth/login-controls";
import { loginAction } from "@/lib/actions/auth";

const loginErrors: Record<string, string> = {
  validation: "Enter a valid email address and password to continue.",
  credentials: "We couldn’t verify those details. Check your email and password and try again.",
  network: "We couldn’t reach the sign-in service. Check your connection and try again.",
  suspended: "This account is currently unavailable. Contact support if you need help.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; password_reset?: string }>;
}) {
  const { error, password_reset: passwordReset } = await searchParams;
  const errorMessage = error ? loginErrors[error] ?? "We couldn’t sign you in. Please try again." : null;

  return (
    <Card className="login-card w-full p-6 sm:p-8">
      <div className="mb-7">
        <p className="login-eyebrow mb-2 text-xs font-bold uppercase tracking-[.16em]">Your learning space</p>
        <h1 className="login-title text-3xl font-bold tracking-tight sm:text-[2.1rem]">Welcome Back.</h1>
        <p className="login-subtitle mt-2 text-sm leading-6 sm:text-base">
          Continue your learning journey. Sign in to pick up where you left off.
        </p>
      </div>

      {passwordReset === "success" && (
        <p className="login-success mb-5 rounded-xl px-4 py-3 text-sm leading-5" role="status">
          Your password has been updated. Sign in with your new password.
        </p>
      )}
      {errorMessage && (
        <p className="login-error mb-5 rounded-xl px-4 py-3 text-sm leading-5" role="alert">
          {errorMessage}
        </p>
      )}

      <form action={loginAction} className="space-y-5">
        <div>
          <Label htmlFor="email" className="login-label">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            required
            className="login-input"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <Label htmlFor="password" className="login-label mb-0">Password</Label>
            <Link className="login-link rounded-sm text-sm font-semibold" href="/reset-password">
              Forgot password?
            </Link>
          </div>
          <LoginPasswordField />
        </div>

        <LoginSubmitButton />
      </form>

      <p className="login-account-prompt mt-6 text-center text-sm">
        Don’t have an account?{" "}
        <Link className="login-link rounded-sm font-bold" href="/register">Create an account</Link>
      </p>
    </Card>
  );
}
