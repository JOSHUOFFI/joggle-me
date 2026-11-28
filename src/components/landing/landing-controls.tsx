"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Menu, Moon, Sun, X } from "lucide-react";

const navigation = [
  { label: "Home", href: "#home", section: "home" },
  { label: "Features", href: "#features", section: "features" },
  { label: "How It Works", href: "#how-it-works", section: "how-it-works" },
  { label: "Community", href: "/dashboard/community", section: "community" },
  { label: "About", href: "#about", section: "about" },
] as const;

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    let frame = 0;
    const syncHeader = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 12);
        const current = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-section]"))
          .filter((section) => section.getBoundingClientRect().top <= 112)
          .at(-1);
        setActiveSection(current?.id ?? "home");
      });
    };

    window.addEventListener("scroll", syncHeader, { passive: true });
    window.addEventListener("resize", syncHeader);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", syncHeader);
      window.removeEventListener("resize", syncHeader);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  function toggleTheme() {
    const nextDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.classList.toggle("light", !nextDark);
    document.documentElement.style.colorScheme = nextDark ? "dark" : "light";
    try {
      window.localStorage.setItem("joggle-theme", nextDark ? "dark" : "light");
    } catch {
      // Theme still changes for this session when storage is unavailable.
    }
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className={`landing-header sticky top-0 z-50 w-full max-w-none ${isScrolled || menuOpen ? "is-scrolled" : ""}`}>
      <div className="landing-header-inner grid h-[76px] w-full max-w-none grid-cols-[1fr_auto_1fr] items-center gap-3 px-[clamp(20px,4vw,64px)]">
        <Link href="/" className="shrink-0" aria-label="JOGGLE ME home" onClick={closeMenu}>
          <Logo variant="responsive" tone="auto" priority />
        </Link>

        <nav className="hidden items-center justify-center gap-4 lg:flex xl:gap-6" aria-label="Main navigation">
          {navigation.map(({ label, href, section }) => (
            <Link key={label} href={href} aria-current={activeSection === section ? "location" : undefined} className={`landing-nav-link ${activeSection === section ? "is-active" : ""}`}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center justify-self-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="landing-theme-button hidden h-10 w-10 items-center justify-center rounded-full border border-[var(--lm-border)] lg:inline-flex"
            aria-label="Toggle color theme"
            title="Toggle color theme"
          >
            <ThemeIcons />
          </button>
          <Link href="/workspace/start?next=%2Fdashboard" className="landing-primary-button hidden h-10 items-center justify-center rounded-full px-5 text-sm font-semibold lg:inline-flex">Start learning <span aria-hidden="true" className="ml-2">→</span></Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="landing-theme-button inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--lm-border)] lg:hidden"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-navigation"
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="landing-mobile-navigation" className="landing-mobile-nav border-t border-[var(--lm-border)] px-5 py-4 lg:hidden" aria-label="Mobile navigation">
          <div className="mx-auto grid max-w-7xl gap-1">
            {navigation.map(({ label, href, section }) => (
              <Link key={label} href={href} onClick={closeMenu} aria-current={activeSection === section ? "location" : undefined} className={`landing-mobile-nav-link rounded-xl px-4 py-3 text-sm font-semibold hover:bg-[var(--lm-hover)] ${activeSection === section ? "is-active" : ""}`}>{label}</Link>
            ))}
            <div className="mt-2 flex gap-2 border-t border-[var(--lm-border)] pt-3">
              <button type="button" onClick={toggleTheme} className="landing-theme-button inline-flex h-11 w-12 items-center justify-center rounded-xl border border-[var(--lm-border)]" aria-label="Toggle color theme">
                <ThemeIcons />
              </button>
              <Link href="/workspace/start?next=%2Fdashboard" onClick={closeMenu} className="landing-primary-button inline-flex h-11 flex-1 items-center justify-center rounded-xl text-sm font-semibold">Start learning <span aria-hidden="true" className="ml-2">→</span></Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

function ThemeIcons() {
  return <><Moon className="theme-moon" size={18} /><Sun className="theme-sun" size={18} /></>;
}
