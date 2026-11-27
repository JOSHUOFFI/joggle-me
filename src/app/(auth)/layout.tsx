import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { AuthThemeToggle } from "@/components/auth/login-controls";

function VisualMessage({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="relative z-10 max-w-sm text-white">
        <h2 className="text-xl font-semibold leading-tight tracking-tight">Your next level starts here.</h2>
        <p className="mt-1 text-xs leading-5 text-white/85">Learn smarter. Make every study session count.</p>
      </div>
    );
  }

  return (
    <div className="relative z-10 max-w-lg text-white">
      <span className="mb-5 inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-white/90 backdrop-blur-sm">
        LEARN. PRACTISE. PROGRESS.
      </span>
      <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        Your next level starts here.
      </h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-white/80 sm:text-base">
        Learn smarter, build confidence and make every study session count.
      </p>
    </div>
  );
}

function LearnerPhoto({ priority = false }: { priority?: boolean }) {
  return (
    <Image
      src="/brand/adult-learner.jpg"
      alt="An adult learner studying with a laptop in a bright, modern workspace"
      fill
      priority={priority}
      sizes="(max-width: 1023px) 100vw, 54vw"
      className="login-learner-image object-cover object-[42%_center]"
    />
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="login-page min-h-screen lg:grid lg:grid-cols-[minmax(420px,.92fr)_1.08fr]">
      <section className="login-form-side flex min-h-screen flex-col px-5 pb-5 pt-5 sm:px-10 sm:pt-7 lg:px-12 xl:px-20">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="JOGGLE ME home" className="rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7655D9]/25">
            <Logo variant="compact" tone="auto" priority />
          </Link>
          <AuthThemeToggle />
        </header>

        <div className="login-mobile-visual relative mt-6 h-40 overflow-hidden rounded-2xl lg:hidden">
          <LearnerPhoto priority />
          <div className="absolute inset-0 bg-gradient-to-t from-[#201345]/85 via-[#35216B]/15 to-transparent" />
          <div className="absolute inset-0 flex items-end p-4">
            <VisualMessage compact />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-8 lg:py-12">
          <div className="w-full max-w-md">{children}</div>
        </div>

        <footer className="pb-1 text-center text-xs login-muted">
          Powered by <span className="font-semibold">JoLight Technologies.</span>
        </footer>
      </section>

      <aside className="login-photo-panel relative hidden min-h-screen overflow-hidden lg:block">
        <LearnerPhoto priority />
        <div className="absolute inset-0 bg-gradient-to-t from-[#201345]/85 via-[#35216B]/20 to-[#35216B]/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_15%,rgba(39,185,214,.19),transparent_42%)]" />
        <div className="absolute inset-x-0 bottom-0 p-12 xl:p-16">
          <VisualMessage />
          <p className="relative z-10 mt-12 text-xs text-white/65">Learn. Challenge Yourself. Level Up.</p>
        </div>
      </aside>
    </main>
  );
}
