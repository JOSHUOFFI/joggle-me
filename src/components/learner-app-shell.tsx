"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bell,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Moon,
  Settings2,
  Sparkles,
  Sun,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";

const navigation = [
  {
    label: "OVERVIEW",
    links: [{ label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard }],
  },
  {
    label: "LEARNING",
    links: [
      { label: "Learning Materials", href: "/dashboard/materials", Icon: FileText },
      { label: "AI Quiz Generator", href: "/dashboard/quizzes/new", Icon: Sparkles },
      { label: "Examinations", href: "/dashboard/quizzes", Icon: ClipboardCheck },
      { label: "Results", href: "/dashboard/performance#performance-history-heading", Icon: Activity },
      { label: "Performance Analytics", href: "/dashboard/performance#subject-performance-heading", Icon: ChartNoAxesCombined },
    ],
  },
  {
    label: "ENGAGEMENT",
    links: [
      { label: "Gamification", href: "/dashboard#gamification", Icon: Trophy },
      { label: "Community", href: "/dashboard/community", Icon: Users },
      { label: "Notifications", href: "/dashboard/community/activity", Icon: Bell },
    ],
  },
  {
    label: "PREFERENCES",
    links: [
      { label: "Settings", href: "/profile", Icon: Settings2 },
      { label: "Help & Support", href: "/dashboard/community/questions", Icon: LifeBuoy },
    ],
  },
] as const;

function routeTitle(pathname: string) {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.includes("/performance")) return "Performance";
  if (pathname.includes("/community")) return "Community";
  if (pathname.includes("/quizzes/new")) return "AI Quiz Generator";
  if (pathname.includes("/quizzes")) return "Examinations";
  if (pathname.includes("/materials")) return "Learning Materials";
  if (pathname === "/profile") return "Settings";
  if (pathname.includes("/exams/")) return "Examination";
  return "Learning Space";
}

function isActiveLink(href: string, pathname: string, currentHash: string) {
  const [route, hash] = href.split("#");
  if (pathname === route && hash) return currentHash ? currentHash === `#${hash}` : route === "/dashboard/performance" && hash === "subject-performance-heading";
  if (pathname !== route) {
    if (route === "/dashboard/quizzes" && pathname.startsWith(`${route}/`) && !pathname.startsWith(`${route}/new`)) return true;
    if (route === "/dashboard/community" && pathname.startsWith(`${route}/`)) {
      return !pathname.startsWith(`${route}/activity`) && !pathname.startsWith(`${route}/questions`);
    }
    if (route === "/dashboard#gamification") return false;
    return false;
  }
  if (route === "/dashboard") return !currentHash;
  return !hash;
}

function ThemeToggle() {
  function toggleTheme() {
    const isDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    try {
      window.localStorage.setItem("joggle-theme", isDark ? "dark" : "light");
    } catch {
      // Keep the selected theme for the current page if storage is unavailable.
    }
  }

  return (
    <button type="button" className="learner-icon-button" onClick={toggleTheme} aria-label="Toggle color theme" title="Toggle color theme">
      <Moon className="theme-moon" size={18} aria-hidden="true" />
      <Sun className="theme-sun" size={18} aria-hidden="true" />
    </button>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "L";
  return <span className="learner-avatar" aria-hidden="true">{initials}</span>;
}

function LearnerSidebar({ name, onNavigate }: { name: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [currentHash, setCurrentHash] = useState("");

  useEffect(() => {
    const updateHash = () => setCurrentHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  return (
    <>
      <div className="learner-brand">
        <Link href="/dashboard" aria-label="JOGGLE ME dashboard" onClick={onNavigate}>
          <Logo variant="compact" tone="auto" />
        </Link>
      </div>
      <nav className="learner-sidebar-nav" aria-label="Learner navigation">
        {navigation.map((group) => (
          <div className="learner-nav-group" key={group.label}>
            <p className="learner-nav-label">{group.label}</p>
            <ul>
              {group.links.map(({ label, href, Icon }) => {
                const active = isActiveLink(href, pathname, currentHash);
                return (
                  <li key={label}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      className={`learner-nav-link${active ? " is-active" : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="learner-sidebar-bottom">
        <Link href="/profile" className="learner-profile-link" onClick={onNavigate}>
          <UserAvatar name={name} />
          <span className="min-w-0">
            <span className="learner-profile-name">{name}</span>
            <span className="learner-profile-role">Learner account</span>
          </span>
        </Link>
        <form action="/auth/logout" method="post">
          <button className="learner-signout" type="submit">
            <LogOut size={17} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </form>
        <p className="learner-powered">Powered by JoLight Technologies.</p>
      </div>
    </>
  );
}

export function LearnerAppShell({
  children,
  learnerName = "Learner",
}: {
  children: React.ReactNode;
  learnerName?: string;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const manageDrawerKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    window.addEventListener("keydown", manageDrawerKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", manageDrawerKeys);
    };
  }, [menuOpen]);

  return (
    <div className="learner-app-shell min-h-screen">
      <aside className="learner-sidebar hidden lg:flex" aria-label="Learner sidebar">
        <LearnerSidebar name={learnerName} />
      </aside>

      <div className="learner-mobile-bar lg:hidden">
        <button
          type="button"
          className="learner-icon-button"
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <Link href="/dashboard" aria-label="JOGGLE ME dashboard"><Logo variant="symbol" tone="auto" /></Link>
        <span className="learner-mobile-title">{routeTitle(pathname)}</span>
        <Link href="/dashboard/community/activity" className="learner-icon-button" aria-label="Community notifications">
          <Bell size={18} aria-hidden="true" />
        </Link>
        <ThemeToggle />
      </div>

      {menuOpen && (
        <div className="learner-drawer-backdrop lg:hidden" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setMenuOpen(false);
        }}>
          <aside ref={drawerRef} className="learner-drawer" role="dialog" aria-modal="true" aria-label="Learner navigation menu">
            <div className="learner-drawer-close">
              <span className="text-xs font-bold uppercase tracking-[.15em]">Menu</span>
              <button ref={closeButtonRef} type="button" className="learner-icon-button" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)}>
                <X size={19} aria-hidden="true" />
              </button>
            </div>
            <LearnerSidebar name={learnerName} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="learner-workspace lg:pl-[272px]">
        <header className="learner-topbar hidden lg:flex">
          <div>
            <p className="learner-breadcrumb">JOGGLE ME <span aria-hidden="true">/</span> Learning space</p>
            <p className="learner-topbar-title">{routeTitle(pathname)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/community/activity" className="learner-icon-button" aria-label="Community notifications" title="Community notifications">
              <Bell size={18} aria-hidden="true" />
            </Link>
            <ThemeToggle />
            <details className="learner-profile-menu">
              <summary aria-label="Open learner profile menu">
                <UserAvatar name={learnerName} />
                <span className="learner-header-profile-name">{learnerName}</span>
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <div className="learner-profile-dropdown">
                <p className="learner-dropdown-name">{learnerName}</p>
                <p className="learner-dropdown-role">Learner account</p>
                <Link href="/profile">Profile and settings</Link>
                <form action="/auth/logout" method="post">
                  <button type="submit"><LogOut size={16} aria-hidden="true" /> Sign out</button>
                </form>
              </div>
            </details>
          </div>
        </header>

        <main className="learner-main mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
