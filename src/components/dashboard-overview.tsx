import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ChartNoAxesCombined,
  CircleCheck,
  Clock3,
  FileText,
  Layers3,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type { DashboardOverview } from "@/lib/dashboard/overview";
import type { GamificationDashboardData } from "@/lib/gamification/data";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function StatCard({
  label,
  value,
  detail,
  Icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  Icon: LucideIcon;
  accent: "violet" | "cyan" | "amber" | "indigo";
}) {
  return (
    <Card className="dashboard-stat-card flex min-w-0 items-start gap-4 p-4 sm:p-5">
      <span className={`dashboard-stat-icon ${accent}`}><Icon size={20} strokeWidth={1.9} aria-hidden="true" /></span>
      <div className="min-w-0">
        <p className="dashboard-muted text-sm">{label}</p>
        <p className="dashboard-stat-value mt-1 text-2xl font-bold tracking-tight">{value}</p>
        <p className="dashboard-muted mt-1 text-xs">{detail}</p>
      </div>
    </Card>
  );
}

export function DashboardWelcome({ name }: { name: string }) {
  return (
    <section className="dashboard-welcome relative isolate overflow-hidden rounded-[1.6rem]">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/brand/adult-learner.jpg"
          alt=""
          fill
          sizes="(max-width: 1023px) 100vw, 76vw"
          className="object-cover object-[44%_54%]"
          priority
        />
      </div>
      <div className="dashboard-welcome-overlay absolute inset-0 -z-0" />
      <div className="relative z-10 max-w-2xl px-6 py-8 text-white sm:px-9 sm:py-10 lg:px-12 lg:py-12">
        <p className="mb-3 text-sm font-semibold text-white/80">Your learning space</p>
        <h1 className="max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Welcome back, {name}.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/85 sm:text-base">
          Keep building your knowledge, one focused session at a time. Pick up where you left off or choose your next step.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard/materials" className="dashboard-welcome-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold">
            Upload a material <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/dashboard/quizzes/new" className="dashboard-welcome-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold">
            Create an AI quiz
          </Link>
        </div>
      </div>
    </section>
  );
}

export function DashboardStats({ data, gamification }: { data: DashboardOverview; gamification: GamificationDashboardData | null }) {
  const recentAverage = data.recentAverage === null ? "—" : `${data.recentAverage}%`;
  const averageDetail = data.completedExamCount === 0
    ? "Complete an examination to see a score"
    : data.completedExamCount === null || !data.attemptsAvailable
      ? "Recent scores are temporarily unavailable"
      : `Average of ${Math.min(6, data.completedExamCount ?? 0)} recent exams`;
  return (
    <section aria-label="Learning overview" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Learning materials" value={data.materialCount === null ? "—" : String(data.materialCount)} detail={data.materialCount === null ? "Count unavailable" : "In your personal library"} Icon={FileText} accent="violet" />
      <StatCard label="Quizzes created" value={data.quizCount === null ? "—" : String(data.quizCount)} detail={data.quizCount === null ? "Count unavailable" : "Generated from your materials"} Icon={Layers3} accent="cyan" />
      <StatCard label="Exams completed" value={data.completedExamCount === null ? "—" : String(data.completedExamCount)} detail={data.completedExamCount === null ? "Count unavailable" : "Submitted examinations"} Icon={CircleCheck} accent="amber" />
      <StatCard label="Recent average score" value={recentAverage} detail={averageDetail} Icon={ChartNoAxesCombined} accent="indigo" />
      {gamification && (
        <div className="dashboard-xp-summary sm:col-span-2 xl:col-span-4">
          <Sparkles size={17} aria-hidden="true" />
          <span><strong>{gamification.totalXp.toLocaleString()} XP</strong> · Level {gamification.level.level}</span>
          <span className="dashboard-muted">{gamification.currentStreak} day study streak</span>
          <Link href="#gamification" className="dashboard-inline-link ml-auto">View achievements <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      )}
    </section>
  );
}

export function ContinueLearning({ data }: { data: DashboardOverview }) {
  if (!data.activeAttemptAvailable) {
    return (
      <Card className="dashboard-continue-card p-5 sm:p-6" role="status">
        <span className="dashboard-kicker">YOUR NEXT STEP</span>
        <h2 className="dashboard-heading mt-2 text-xl font-bold">Continue Your Learning Journey</h2>
        <p className="dashboard-muted mt-2 text-sm leading-6">We couldn’t check for an active examination just now. You can still explore your quizzes.</p>
        <Link href="/dashboard/quizzes" className="dashboard-primary-link mt-5 inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl px-4 text-sm font-semibold">View quizzes <ArrowRight size={16} aria-hidden="true" /></Link>
      </Card>
    );
  }
  if (data.activeAttempt) {
    return (
      <Card className="dashboard-continue-card flex h-full flex-col justify-between p-5 sm:p-6">
        <div>
          <span className="dashboard-kicker">PICK UP WHERE YOU LEFT OFF</span>
          <h2 className="dashboard-heading mt-2 text-xl font-bold">Continue your examination</h2>
          <p className="dashboard-muted mt-2 text-sm leading-6">{data.activeAttempt.quizTitle}</p>
          <p className="dashboard-muted mt-1 flex items-center gap-1.5 text-xs"><Clock3 size={14} aria-hidden="true" /> Started {formatDate(data.activeAttempt.started_at)}</p>
        </div>
        <Link href={`/dashboard/exams/${data.activeAttempt.id}`} className="dashboard-primary-link mt-5 inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl px-4 text-sm font-semibold">
          Resume examination <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </Card>
    );
  }

  const nextQuiz = data.recentQuizzes.find((quiz) => quiz.generation_status === "ready");
  return (
    <Card className="dashboard-continue-card flex h-full flex-col justify-between p-5 sm:p-6">
      <div>
        <span className="dashboard-kicker">YOUR NEXT STEP</span>
        <h2 className="dashboard-heading mt-2 text-xl font-bold">Continue Your Learning Journey</h2>
        <p className="dashboard-muted mt-2 text-sm leading-6">
          {nextQuiz
            ? `Your latest ready quiz is “${nextQuiz.title}”. Start an examination when you’re ready.`
            : "Add a study material and turn it into a focused practice quiz."}
        </p>
      </div>
      {nextQuiz ? (
        <Link href={`/dashboard/quizzes/${nextQuiz.id}`} className="dashboard-primary-link mt-5 inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl px-4 text-sm font-semibold">
          Open latest quiz <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <Link href="/dashboard/materials" className="dashboard-primary-link mt-5 inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl px-4 text-sm font-semibold">
          Add learning material <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </Card>
  );
}

export function RecentMaterialsPreview({ data }: { data: DashboardOverview }) {
  return (
    <Card className="dashboard-panel h-full p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="dashboard-heading text-lg font-bold">Recent learning materials</h2>
          <p className="dashboard-muted mt-1 text-sm">Your latest documents and analysis state</p>
        </div>
        <Link href="/dashboard/materials" className="dashboard-inline-link shrink-0">View library <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
      {!data.documentsAvailable ? (
        <p className="dashboard-muted mt-4 rounded-xl bg-[#F7F7FC] p-4 text-sm" role="status">Recent materials could not be loaded right now.</p>
      ) : data.recentDocuments.length ? (
        <ul className="mt-4 divide-y dashboard-divider">
          {data.recentDocuments.map((document) => (
            <li key={document.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="dashboard-list-icon"><FileText size={17} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <Link href={`/dashboard/materials/${document.id}`} className="dashboard-heading block truncate text-sm font-semibold hover:underline">{document.original_filename}</Link>
                <p className="dashboard-muted mt-1 text-xs">{document.file_type.toUpperCase()} · {formatDate(document.created_at)}</p>
              </div>
              <span className={`dashboard-status ${document.analysis_status}`}>{document.analysis_status === "ready" ? "Analysed" : document.analysis_status === "failed" ? "Needs attention" : "Processing"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="dashboard-empty-state mt-4 rounded-xl p-4">
          <p className="text-sm font-semibold">Your materials will appear here.</p>
          <p className="dashboard-muted mt-1 text-xs">Upload a PDF, DOCX, or TXT document to get started.</p>
        </div>
      )}
    </Card>
  );
}

export function RecentQuizzesPreview({ data }: { data: DashboardOverview }) {
  return (
    <Card className="dashboard-panel h-full p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="dashboard-heading text-lg font-bold">Recent quizzes</h2>
          <p className="dashboard-muted mt-1 text-sm">Practice built from your study materials</p>
        </div>
        <Link href="/dashboard/quizzes" className="dashboard-inline-link shrink-0">View quizzes <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
      {!data.quizzesAvailable ? (
        <p className="dashboard-muted mt-4 rounded-xl bg-[#F7F7FC] p-4 text-sm" role="status">Recent quizzes could not be loaded right now.</p>
      ) : data.recentQuizzes.length ? (
        <ul className="mt-4 divide-y dashboard-divider">
          {data.recentQuizzes.map((quiz) => (
            <li key={quiz.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="dashboard-list-icon cyan"><BookOpen size={17} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <Link href={`/dashboard/quizzes/${quiz.id}`} className="dashboard-heading block truncate text-sm font-semibold hover:underline">{quiz.title}</Link>
                <p className="dashboard-muted mt-1 text-xs">{quiz.question_count} questions · {formatDate(quiz.created_at)}</p>
              </div>
              <span className={`dashboard-status ${quiz.generation_status}`}>{quiz.generation_status === "ready" ? "Ready" : quiz.generation_status === "failed" ? "Failed" : "Creating"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="dashboard-empty-state mt-4 rounded-xl p-4">
          <p className="text-sm font-semibold">No quizzes yet.</p>
          <p className="dashboard-muted mt-1 text-xs">Once you analyse a material, you can generate a quiz from it.</p>
        </div>
      )}
    </Card>
  );
}

export function PerformancePreview({ data }: { data: DashboardOverview }) {
  const attempts = [...data.recentAttempts].reverse();
  const points = attempts.map((attempt, index) => ({
    x: attempts.length < 2 ? 250 : 28 + index * (444 / (attempts.length - 1)),
    y: 126 - attempt.percentage,
    value: attempt.percentage,
  }));
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <Card className="dashboard-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="dashboard-heading text-lg font-bold">Performance overview</h2>
          <p className="dashboard-muted mt-1 text-sm">Your six most recent examination scores</p>
        </div>
        <Link href="/dashboard/performance" className="dashboard-inline-link">Detailed analytics <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
      {data.completedExamCount === null || !data.attemptsAvailable ? (
        <p className="dashboard-muted mt-5 rounded-xl bg-[#F7F7FC] p-5 text-sm" role="status">Recent examination scores are temporarily unavailable.</p>
      ) : attempts.length ? (
        <div className="mt-5">
          <div className="dashboard-chart-wrap">
            <div className="dashboard-chart-labels" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div>
            <svg className="dashboard-chart" viewBox="0 0 500 140" role="img" aria-label={`Recent examination scores: ${attempts.map((attempt) => `${Math.round(attempt.percentage)} percent`).join(", ")}`}>
              {[26, 76, 126].map((y) => <line key={y} x1="20" x2="480" y1={y} y2={y} className="dashboard-chart-gridline" />)}
              {points.length > 1 && <polyline points={path} className="dashboard-chart-line" />}
              {points.map((point, index) => <circle key={attempts[index].id} cx={point.x} cy={point.y} r="4.5" className="dashboard-chart-point"><title>{`${Math.round(point.value)}% on ${formatDate(attempts[index].submitted_at)}`}</title></circle>)}
            </svg>
          </div>
          <div className="dashboard-muted mt-2 flex justify-between text-xs"><span>{formatDate(attempts[0].submitted_at)}</span><span>{formatDate(attempts.at(-1)!.submitted_at)}</span></div>
        </div>
      ) : (
        <div className="dashboard-empty-state mt-5 rounded-xl p-5">
          <p className="text-sm font-semibold">Your score trend will appear after your first examination.</p>
          <Link href="/dashboard/quizzes" className="dashboard-inline-link mt-3">Explore your quizzes <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      )}
    </Card>
  );
}

export function RecommendationPanel({ data }: { data: DashboardOverview }) {
  const readyMaterial = data.analyzedMaterialCount !== null && data.analyzedMaterialCount > 0;
  const dataUnavailable = data.completedExamCount === null || data.readyQuizCount === null || data.materialCount === null || data.analyzedMaterialCount === null;
  const recommendation = data.completedExamCount !== null && data.completedExamCount > 0
    ? { title: "Review your recent performance", detail: "See your results and choose a topic to strengthen.", href: "/dashboard/performance", label: "View analytics" }
    : dataUnavailable
      ? { title: "Explore your learning tools", detail: "Your personal learning data is temporarily unavailable. Choose a tool to continue.", href: "/dashboard/quizzes", label: "View learning tools" }
      : data.readyQuizCount !== null && data.readyQuizCount > 0
      ? { title: "Put your practice into action", detail: "Choose a ready quiz and start an examination.", href: "/dashboard/quizzes", label: "Explore quizzes" }
      : readyMaterial
        ? { title: "Create a quiz from your material", detail: "Use your analysed study notes to build focused practice.", href: "/dashboard/quizzes/new", label: "Generate a quiz" }
        : data.materialCount !== null && data.materialCount > 0
          ? { title: "Check your material library", detail: "Review processing status and open any materials that are ready to use.", href: "/dashboard/materials", label: "View materials" }
          : { title: "Build your learning library", detail: "Add study notes and discover the learning tools available to you.", href: "/dashboard/materials", label: "Upload material" };
  return (
    <Card className="dashboard-recommendation flex h-full flex-col justify-between p-5 sm:p-6">
      <div>
        <span className="dashboard-kicker">A SUGGESTED NEXT STEP</span>
        <h2 className="dashboard-heading mt-2 text-lg font-bold">{recommendation.title}</h2>
        <p className="dashboard-muted mt-2 text-sm leading-6">{recommendation.detail}</p>
      </div>
      <Link href={recommendation.href} className="dashboard-inline-link mt-4 self-start">{recommendation.label} <ArrowRight size={15} aria-hidden="true" /></Link>
    </Card>
  );
}

export function RecentActivity({ data }: { data: DashboardOverview }) {
  const events = [
    ...data.recentDocuments.map((document) => ({
      id: `document-${document.id}`,
      title: document.analysis_status === "ready" ? "Material analysed" : "Material added",
      detail: document.original_filename,
      date: document.created_at,
      href: `/dashboard/materials/${document.id}`,
      Icon: FileText,
    })),
    ...data.recentQuizzes.map((quiz) => ({
      id: `quiz-${quiz.id}`,
      title: "Quiz created",
      detail: quiz.title,
      date: quiz.created_at,
      href: `/dashboard/quizzes/${quiz.id}`,
      Icon: BookOpen,
    })),
    ...data.recentAttempts.map((attempt) => ({
      id: `attempt-${attempt.id}`,
      title: "Examination completed",
      detail: `${Math.round(attempt.percentage)}% score`,
      date: attempt.submitted_at,
      href: `/dashboard/exams/${attempt.id}/results`,
      Icon: CircleCheck,
    })),
  ].sort((first, second) => Date.parse(second.date) - Date.parse(first.date)).slice(0, 5);

  return (
    <Card className="dashboard-panel p-5 sm:p-6">
      <h2 className="dashboard-heading text-lg font-bold">Recent activity</h2>
      <p className="dashboard-muted mt-1 text-sm">A timeline of your learning activity</p>
      {events.length ? (
        <ul className="mt-4 space-y-1">
          {events.map(({ id, title, detail, date, href, Icon }) => (
            <li key={id}>
              <Link href={href} className="dashboard-activity-link flex items-center gap-3 rounded-xl px-2 py-3">
                <span className="dashboard-list-icon"><Icon size={17} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="dashboard-heading block text-sm font-semibold">{title}</span><span className="dashboard-muted mt-0.5 block truncate text-xs">{detail}</span></span>
                <time className="dashboard-muted shrink-0 text-xs">{formatDate(date)}</time>
              </Link>
            </li>
          ))}
        </ul>
      ) : !data.documentsAvailable && !data.quizzesAvailable && !data.attemptsAvailable ? (
        <p className="dashboard-muted mt-4 rounded-xl bg-[#F7F7FC] p-4 text-sm" role="status">Recent activity is temporarily unavailable.</p>
      ) : (
        <p className="dashboard-muted mt-4 rounded-xl bg-[#F7F7FC] p-4 text-sm">Your learning activity will appear here as you explore the platform.</p>
      )}
    </Card>
  );
}
