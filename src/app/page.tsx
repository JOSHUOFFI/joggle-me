import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Check,
  Clock3,
  Flame,
  GraduationCap,
  Layers3,
  Sparkles,
  Trophy,
  Upload,
  UsersRound,
} from "lucide-react";
import { LandingHeader } from "@/components/landing/landing-controls";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Learn Smarter, Level Up",
  description: "JOGGLE ME is your AI-powered learning companion, helping you study smarter, practise effectively and achieve more.",
  openGraph: {
    title: "Learn Smarter, Level Up | JOGGLE ME",
    description: "Your AI-powered learning companion. Learn. Challenge Yourself. Level Up.",
    siteName: "JOGGLE ME",
    type: "website",
    images: [{ url: "/brand/joggle-me-logo.png", width: 1672, height: 941, alt: "JOGGLE ME — Learn. Challenge Yourself. Level Up." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Learn Smarter, Level Up | JOGGLE ME",
    description: "Your AI-powered learning companion. Learn. Challenge Yourself. Level Up.",
    images: ["/brand/joggle-me-logo.png"],
  },
};

const features = [
  { icon: Sparkles, title: "AI-Powered Learning", description: "A smarter, more personal way to study from your own materials.", tone: "violet" },
  { icon: Clock3, title: "Timed Examinations", description: "Practise under realistic exam conditions and build confidence.", tone: "cyan" },
  { icon: ChartNoAxesColumnIncreasing, title: "Performance Analytics", description: "See where you are improving and what to focus on next.", tone: "amber" },
  { icon: Trophy, title: "Gamified Progress", description: "Earn XP, unlock badges and celebrate meaningful milestones.", tone: "violet" },
  { icon: UsersRound, title: "Active Community", description: "Share ideas, ask questions and learn alongside others.", tone: "cyan" },
] as const;

const steps = [
  { icon: Upload, number: "01", title: "Upload Materials", description: "Add your study materials, including PDFs, notes and documents." },
  { icon: Sparkles, number: "02", title: "Generate & Learn", description: "Use AI to create quizzes grounded in your material and begin learning." },
  { icon: ChartNoAxesColumnIncreasing, number: "03", title: "Track Progress", description: "Review your results and get personalised recommendations." },
] as const;

const faqs = [
  { question: "What can I study with JOGGLE ME?", answer: "Bring your own learning materials, then use them to create focused practice quizzes and timed examinations." },
  { question: "Can I see how I am progressing?", answer: "Your dashboard brings your learning activity, assessment results and recommendations together." },
  { question: "Is the community open to everyone?", answer: "Community areas are part of the learner experience and require an account so members can participate safely." },
] as const;

const previewCards = [
  { icon: BookOpen, label: "Materials" },
  { icon: Sparkles, label: "Practice" },
  { icon: Trophy, label: "Progress" },
] as const;

export default function Home() {
  return (
    <main id="home" data-landing-page className="landing-page min-h-screen overflow-x-clip bg-[var(--lm-background)] text-[var(--lm-foreground)]">
      <LandingHeader />

      <section className="landing-hero relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-14 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:min-h-[600px] lg:grid-cols-[1.06fr_.94fr] lg:gap-8 lg:py-14">
        <div className="relative z-10 max-w-[590px]">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#7655D9]/15 bg-[#7655D9]/[0.07] px-3.5 py-2 text-xs font-bold uppercase tracking-[.11em] text-[#6745C4] dark:text-[#B5A2FF]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#27B9D6]" /> Your learning, moving forward
          </p>
          <h1 className="max-w-[660px] text-[clamp(2.55rem,4vw,3.25rem)] font-bold leading-[1.05] tracking-[-.05em] text-[var(--lm-foreground)]">
            <span className="block lg:whitespace-nowrap">Learn. Challenge Yourself.</span><span className="block text-[#7655D9] dark:text-[#A892FF]">Level Up.</span>
          </h1>
          <p className="mt-6 max-w-[510px] text-base leading-7 text-[var(--lm-muted)] sm:text-lg sm:leading-8">
            JOGGLE ME is your AI-powered learning companion, helping you study smarter, practise effectively and achieve more.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/workspace/start?next=%2Fdashboard" className="landing-primary-button inline-flex min-h-12 items-center justify-center rounded-full px-7 text-sm font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7655D9]/25">
              Start Learning <ArrowRight size={17} className="ml-2" />
            </Link>
            <Link href="#features" className="landing-secondary-button inline-flex min-h-12 items-center justify-center rounded-full border border-[#7655D9]/35 px-7 text-sm font-semibold transition-colors hover:bg-[#7655D9]/[0.06] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7655D9]/20">
              <span className="mr-2 text-[#7655D9]" aria-hidden="true">▶</span> Explore Features
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-[var(--lm-muted)]">
            <span className="inline-flex items-center gap-2"><Check size={16} className="text-[#168B73]" /> Learn from your materials</span>
            <span className="inline-flex items-center gap-2"><Check size={16} className="text-[#168B73]" /> Progress at your pace</span>
          </div>
        </div>

        <div className="hero-visual relative mx-auto w-full max-w-[650px] lg:ml-auto">
          <div className="hero-orbit absolute -inset-4 -z-10 rounded-[44%] bg-[radial-gradient(ellipse_at_60%_45%,rgba(118,85,217,0.2),transparent_68%)]" />
          <div className="hero-photo-frame relative aspect-[1.14/1] overflow-hidden rounded-[34px] border border-white/70 bg-[#E9E7F2] shadow-[0_28px_70px_rgba(38,25,82,0.18)] dark:border-white/10 dark:bg-[#242035] sm:aspect-[1.22/1]">
            <Image
              src="/brand/adult-learner.jpg"
              alt="Adult learner focused on a laptop in a calm, modern workspace"
              width={1600}
              height={900}
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 52vw, 650px"
              className="hero-photo h-full w-full object-cover object-[34%_center]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#19152B]/25 via-transparent to-transparent" aria-hidden="true" />
            <span className="absolute bottom-4 left-4 rounded-full border border-white/30 bg-black/25 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur">A focused space to grow</span>
          </div>

          <div className="hero-float hero-float-progress absolute -right-2 top-[11%] flex w-[185px] items-center gap-3 rounded-2xl border border-white/70 bg-white/95 p-3.5 shadow-[0_16px_42px_rgba(37,28,82,.16)] backdrop-blur dark:border-white/10 dark:bg-[#211D31]/95 sm:-right-5 sm:w-[202px]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F4C84A]/20 text-[#9B7410]"><GraduationCap size={22} /></span>
            <span className="min-w-0"><span className="block text-[10px] font-medium text-[#77758A] dark:text-[#B6B2C5]">Illustrative preview</span><span className="mt-0.5 block text-sm font-bold">Learning in motion</span><span className="mt-1.5 flex gap-1"><i className="h-1.5 w-7 rounded-full bg-[#7655D9]" /><i className="h-1.5 w-7 rounded-full bg-[#7655D9]/55" /><i className="h-1.5 w-7 rounded-full bg-[#7655D9]/20" /></span></span>
          </div>
          <div className="hero-float hero-float-streak absolute bottom-[12%] right-1 flex items-center gap-2.5 rounded-2xl border border-white/70 bg-white/95 px-3.5 py-3 shadow-[0_16px_42px_rgba(37,28,82,.14)] backdrop-blur dark:border-white/10 dark:bg-[#211D31]/95 sm:-right-4">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#F4C84A]/20 text-[#BB6512]"><Flame size={18} /></span>
            <span><span className="block text-xs font-bold">Build a steady habit</span><span className="mt-0.5 block text-[10px] text-[#77758A] dark:text-[#B6B2C5]">Small steps add up</span></span>
          </div>
        </div>
      </section>

      <section id="features" data-nav-section className="landing-features border-y border-[var(--lm-border)] bg-[var(--lm-surface)]/75 scroll-mt-24">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-[var(--lm-border)] px-5 sm:grid-cols-3 sm:px-8 lg:grid-cols-5 lg:divide-y-0">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <ScrollReveal key={feature.title} className="feature-cell flex min-h-[174px] flex-col items-center justify-center px-3 py-7 text-center sm:px-5 lg:min-h-[188px] lg:border-r lg:border-[var(--lm-border)] lg:last:border-r-0">
                <span className={`mb-3 grid h-11 w-11 place-items-center rounded-2xl ${feature.tone === "cyan" ? "bg-[#27B9D6]/10 text-[#13849B] dark:text-[#57D2E8]" : feature.tone === "amber" ? "bg-[#F4C84A]/20 text-[#9A7413] dark:text-[#F4C84A]" : "bg-[#7655D9]/10 text-[#7655D9] dark:text-[#AD98FF]"}`}>
                  <Icon size={21} strokeWidth={1.9} />
                </span>
                <h2 className="text-sm font-bold tracking-[-.02em] sm:text-[15px]">{feature.title}</h2>
                <p className="mt-2 max-w-[190px] text-xs leading-5 text-[var(--lm-muted)] sm:text-[13px]">{feature.description}</p>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      <section id="how-it-works" data-nav-section className="landing-steps scroll-mt-24 px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <ScrollReveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#7655D9] dark:text-[#AD98FF]">How JOGGLE ME works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Your Learning Journey, Made Simple</h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--lm-muted)]">Get started in just a few clicks and unlock a world of intelligent learning tools.</p>
          </ScrollReveal>
          <div className="relative mt-14 grid gap-8 md:grid-cols-3 md:gap-10">
            <div className="step-connector absolute left-[17%] right-[17%] top-7 hidden border-t border-dashed border-[#BFB2F2] md:block" aria-hidden="true" />
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <ScrollReveal key={step.number} className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 grid h-14 w-14 place-items-center rounded-2xl border border-[#7655D9]/15 bg-[var(--lm-surface)] text-[#7655D9] shadow-[0_8px_24px_rgba(53,33,107,.08)] dark:text-[#AD98FF]">
                    <Icon size={24} strokeWidth={1.8} />
                    <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-[#7655D9] text-[10px] font-bold text-white">{step.number.slice(1)}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 max-w-[300px] text-sm leading-6 text-[var(--lm-muted)]">{step.description}</p>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="landing-dashboard-section px-5 pb-20 sm:px-8 sm:pb-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.12fr_.88fr] lg:gap-16">
          <ScrollReveal className="dashboard-preview-wrap min-w-0">
            <div className="dashboard-preview overflow-hidden rounded-[24px] border border-[var(--lm-border)] bg-[var(--lm-surface)] shadow-[0_26px_70px_rgba(53,33,107,.13)]">
              <div className="flex h-11 items-center justify-between border-b border-[var(--lm-border)] px-4 sm:px-5">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#F4C84A]" /><span className="h-2 w-2 rounded-full bg-[#27B9D6]" /><span className="h-2 w-2 rounded-full bg-[#7655D9]" /></div>
                <span className="rounded-full bg-[#7655D9]/10 px-2.5 py-1 text-[9px] font-semibold text-[#7655D9] dark:text-[#AD98FF]">Illustrative preview</span>
              </div>
              <div className="grid min-h-[330px] grid-cols-[110px_1fr] sm:grid-cols-[150px_1fr]">
                <aside className="bg-[#30205F] px-2 py-4 text-white sm:px-3" aria-label="Illustrative dashboard navigation">
                  <div className="mb-5 flex items-center gap-1.5 px-1.5"><span className="grid h-6 w-6 place-items-center overflow-hidden rounded-lg bg-white"><Logo variant="symbol" className="!w-6" /></span><span className="hidden text-[9px] font-bold tracking-wide sm:inline">JOGGLE ME</span></div>
                  <div className="space-y-1 text-[9px] font-medium text-white/75">
                    <div className="flex items-center gap-2 rounded-lg bg-white/15 px-2 py-2 text-white"><Layers3 size={13} /> Overview</div>
                    <div className="flex items-center gap-2 px-2 py-2"><BookOpen size={13} /> Materials</div>
                    <div className="flex items-center gap-2 px-2 py-2"><Sparkles size={13} /> Practice</div>
                    <div className="flex items-center gap-2 px-2 py-2"><Trophy size={13} /> Achievements</div>
                  </div>
                </aside>
                <div className="min-w-0 p-3 sm:p-5">
                  <p className="text-[9px] font-semibold text-[#7655D9] dark:text-[#AD98FF]">YOUR LEARNING SPACE</p>
                  <h3 className="mt-1 text-sm font-bold sm:text-lg">A clearer view of your progress</h3>
                  <p className="mt-1 text-[10px] text-[var(--lm-muted)] sm:text-xs">Your learning activities, all in one place.</p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {previewCards.map(({ icon: CardIcon, label }) => <div key={label} className="rounded-xl border border-[var(--lm-border)] bg-[var(--lm-surface)] p-2 sm:p-3"><CardIcon size={15} className="text-[#7655D9] dark:text-[#AD98FF]" /><p className="mt-2 truncate text-[9px] font-semibold sm:text-[10px]">{label}</p><p className="mt-1 text-[8px] text-[var(--lm-muted)]">Keep moving forward</p></div>)}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1.15fr_.85fr]">
                    <div className="rounded-xl border border-[var(--lm-border)] p-3"><div className="flex items-center justify-between"><p className="text-[10px] font-bold">Learning activity</p><span className="text-[8px] text-[var(--lm-muted)]">Example view</span></div><div className="mt-4 flex h-[92px] items-end justify-around gap-2 border-b border-l border-[var(--lm-border)] px-2"><i className="w-3 rounded-t bg-[#7655D9]/35" style={{ height: "38%" }} /><i className="w-3 rounded-t bg-[#7655D9]/50" style={{ height: "62%" }} /><i className="w-3 rounded-t bg-[#27B9D6]/70" style={{ height: "48%" }} /><i className="w-3 rounded-t bg-[#7655D9]/70" style={{ height: "82%" }} /><i className="w-3 rounded-t bg-[#7655D9]" style={{ height: "68%" }} /><i className="w-3 rounded-t bg-[#F4C84A]" style={{ height: "95%" }} /></div></div>
                    <div className="rounded-xl border border-[var(--lm-border)] p-3"><p className="text-[10px] font-bold">Next steps</p><div className="mt-3 space-y-3">{["Review a topic", "Try a practice quiz", "Check your results"].map((item) => <p key={item} className="flex items-center gap-2 text-[8px] text-[var(--lm-muted)]"><span className="grid h-4 w-4 place-items-center rounded-full bg-[#27B9D6]/10 text-[#13849B]"><Check size={10} /></span>{item}</p>)}</div></div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
          <ScrollReveal>
            <p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[#7655D9] dark:text-[#AD98FF]">A better way to stay on track</p>
            <h2 className="max-w-lg text-3xl font-bold leading-tight tracking-[-.04em] sm:text-4xl">A Powerful Learning Dashboard</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--lm-muted)]">Get a clear overview of your learning activities, progress and achievements — all in one place.</p>
            <ul className="mt-6 space-y-3 text-sm font-medium">
              {["Track your performance", "Earn rewards and badges", "Discover personalised recommendations"].map((item) => <li key={item} className="flex items-center gap-3"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#188B71] text-white"><Check size={13} strokeWidth={3} /></span>{item}</li>)}
            </ul>
            <Link href="/dashboard" className="landing-primary-button mt-8 inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold">Explore Dashboard <ArrowRight size={16} className="ml-2" /></Link>
          </ScrollReveal>
        </div>
      </section>

      <section id="community" data-nav-section className="landing-community mx-auto mb-20 grid max-w-7xl scroll-mt-24 overflow-hidden rounded-[28px] bg-[#24164F] text-white shadow-[0_24px_60px_rgba(37,24,79,.2)] sm:mx-8 lg:grid-cols-[.82fr_1.18fr]">
        <div className="relative z-10 flex flex-col items-start justify-center px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#BCA9FF]"><UsersRound size={25} /></span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-[#BCA9FF]">A thoughtful space to connect</p>
          <h2 className="mt-2 max-w-md text-3xl font-bold leading-tight tracking-[-.035em] sm:text-[2.35rem]">Learn Together, Grow Faster</h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/75 sm:text-base">Join our community, ask questions, share tips and learn from others.</p>
          <Link href="/dashboard/community" className="mt-7 inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-bold text-[#35216B] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40">Explore Community <ArrowRight size={16} className="ml-2" /></Link>
        </div>
        <div className="community-photo relative min-h-[250px] sm:min-h-[320px] lg:min-h-[370px]">
          <Image src="/brand/learning-community.jpg" alt="A diverse group of adult learners sharing ideas around a laptop" width={1400} height={933} sizes="(max-width: 1024px) 100vw, 55vw" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#24164F] via-[#24164F]/45 to-transparent lg:from-[#24164F]/45 lg:via-transparent" aria-hidden="true" />
          <span className="absolute bottom-4 right-4 rounded-full bg-black/35 px-3 py-1.5 text-[10px] text-white/90 backdrop-blur">A community for adult learners</span>
        </div>
      </section>

      <section id="faq" className="landing-faq scroll-mt-24 px-5 pb-20 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[.7fr_1.3fr] md:gap-16">
          <ScrollReveal>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#7655D9] dark:text-[#AD98FF]">A few helpful notes</p>
            <h2 className="mt-3 text-2xl font-bold tracking-[-.035em] sm:text-3xl">Frequently asked questions</h2>
          </ScrollReveal>
          <div className="divide-y divide-[var(--lm-border)] border-y border-[var(--lm-border)]">
            {faqs.map((faq) => <details key={faq.question} className="group py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold marker:hidden">{faq.question}<span className="text-lg text-[#7655D9] transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary><p className="max-w-2xl pt-3 pr-8 text-sm leading-6 text-[var(--lm-muted)]">{faq.answer}</p></details>)}
          </div>
        </div>
      </section>

      <footer id="about" data-nav-section className="landing-footer scroll-mt-20 bg-[#17113B] px-5 text-white sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.35fr_.8fr_.8fr_1fr] lg:gap-8 lg:py-14">
          <div>
            <Link href="/" aria-label="JOGGLE ME home" className="inline-block rounded-lg bg-white px-2 py-1"><Logo variant="compact" /></Link>
            <p className="mt-4 max-w-[300px] text-sm leading-6 text-white/70">Learn. Challenge Yourself. Level Up.</p>
            <p className="mt-3 text-sm font-medium text-white/90">Powered by JoLight Technologies.</p>
            <p className="mt-4 text-[11px] text-white/50">Photography: <a href="https://unsplash.com/@vitalygariev" target="_blank" rel="noreferrer" className="underline decoration-white/30 underline-offset-2 hover:text-white">Vitaly Gariev</a> and <a href="https://unsplash.com/photos/1522202176988-66273c2fd55f" target="_blank" rel="noreferrer" className="underline decoration-white/30 underline-offset-2 hover:text-white">Unsplash contributors</a>.</p>
          </div>
          <FooterLinks title="Quick Links" links={[["Home", "#home"], ["Features", "#features"], ["How It Works", "#how-it-works"], ["Community", "/dashboard/community"], ["About", "#about"]]} />
          <FooterLinks title="Get Started" links={[["Start a guest workspace", "/workspace/start?next=%2Fdashboard"], ["Learning FAQs", "#faq"]]} />
          <div><h2 className="text-sm font-bold">Made for lifelong learning</h2><p className="mt-3 text-sm leading-6 text-white/65">A calmer way to practise, see your progress and keep moving toward your goals.</p><Link href="/workspace/start?next=%2Fdashboard" className="mt-5 inline-flex items-center text-sm font-semibold text-[#C0B0FF] hover:text-white">Start learning <ArrowRight size={15} className="ml-2" /></Link></div>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-white/10 py-5 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} JOGGLE ME. Powered by JoLight Technologies. All rights reserved.</p>
          <p>Photography used under the Unsplash License.</p>
        </div>
      </footer>
    </main>
  );
}

function FooterLinks({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return <div><h2 className="text-sm font-bold">{title}</h2><ul className="mt-4 space-y-3">{links.map(([label, href]) => <li key={label}><Link href={href} className="text-sm text-white/65 transition-colors hover:text-white">{label}</Link></li>)}</ul></div>;
}
