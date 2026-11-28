import { LearnerAppShell } from "@/components/learner-app-shell";

export function AppShell({
  children,
  learnerName,
}: {
  children: React.ReactNode;
  learnerName?: string;
}) {
  return <LearnerAppShell learnerName={learnerName}>{children}</LearnerAppShell>;
}
