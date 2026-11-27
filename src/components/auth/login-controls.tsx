"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthThemeToggle() {
  function toggleTheme() {
    const nextDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.classList.toggle("light", !nextDark);
    document.documentElement.style.colorScheme = nextDark ? "dark" : "light";
    try {
      window.localStorage.setItem("joggle-theme", nextDark ? "dark" : "light");
    } catch {
      // The current page theme still changes if browser storage is unavailable.
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="login-theme-toggle inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7655D9]/20"
      aria-label="Toggle color theme"
      title="Toggle color theme"
    >
      <Moon className="theme-moon" size={18} aria-hidden="true" />
      <Sun className="theme-sun" size={18} aria-hidden="true" />
    </button>
  );
}

export function LoginPasswordField() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id="password"
        name="password"
        type={visible ? "text" : "password"}
        autoComplete="current-password"
        required
        className="login-input pr-12"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="login-password-toggle absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-xl transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#7655D9]/20"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="login-submit w-full" size="lg" disabled={pending}>
      {pending ? "Signing in…" : "Sign In"}
    </Button>
  );
}
