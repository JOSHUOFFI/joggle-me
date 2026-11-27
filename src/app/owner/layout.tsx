import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["platform_owner", "platform_administrator"]);
  return <AppShell owner>{children}</AppShell>;
}
