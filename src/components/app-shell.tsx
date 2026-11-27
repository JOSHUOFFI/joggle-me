import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { LearnerAppShell } from "@/components/learner-app-shell";

export function AppShell({
  children,
  owner = false,
  learnerName,
}: {
  children: React.ReactNode;
  owner?: boolean;
  learnerName?: string;
}) {
  if (!owner) return <LearnerAppShell learnerName={learnerName}>{children}</LearnerAppShell>;

  return (
    <div className="min-h-screen bg-[#F7F7FC]">
      <header className="border-b border-[#ECEAF5] bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 py-2 sm:h-16 sm:flex-nowrap sm:gap-0 sm:py-0 sm:px-6">
          <Link href={owner ? "/owner" : "/dashboard"} aria-label="JOGGLE ME home">
            <Logo variant="responsive" />
          </Link>
          <div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto sm:flex-nowrap sm:gap-2">
            <nav className="flex flex-wrap items-center justify-end gap-0 text-[11px] sm:flex-nowrap sm:gap-1 sm:text-sm" aria-label="Primary navigation">
              <>
                  <Link className="rounded-lg px-2 py-2 font-semibold text-[#35216B] hover:bg-[#F7F7FC] sm:px-3" href="/owner">Overview</Link>
                  <Link className="rounded-lg px-2 py-2 font-semibold text-[#35216B] hover:bg-[#F7F7FC] sm:px-3" href="/owner/users">Users</Link>
                  <Link className="rounded-lg px-2 py-2 font-semibold text-[#35216B] hover:bg-[#F7F7FC] sm:px-3" href="/owner/features">Features</Link>
                  <Link className="rounded-lg px-2 py-2 font-semibold text-[#35216B] hover:bg-[#F7F7FC] sm:px-3" href="/owner/community">Community</Link>
                  <Link className="rounded-lg px-2 py-2 font-semibold text-[#35216B] hover:bg-[#F7F7FC] sm:px-3" href="/owner/audit">Audit</Link>
              </>
            </nav>
            <form action="/auth/logout" method="post" className="shrink-0">
              <Button type="submit" variant="ghost" size="sm">Log out</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        {children}
      </main>
    </div>
  );
}
