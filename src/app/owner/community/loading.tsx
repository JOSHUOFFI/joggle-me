import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export default function OwnerCommunityLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading community management">
      <div className="mb-5" aria-hidden="true"><Logo variant="symbol" /></div>
      <span className="sr-only">Loading community management…</span>
      <div className="mb-6 space-y-3" aria-hidden="true">
        <div className="h-4 w-32 animate-pulse rounded bg-[#ECEAF5]" />
        <div className="h-9 w-72 max-w-full animate-pulse rounded bg-[#ECEAF5]" />
        <div className="h-4 w-full max-w-3xl animate-pulse rounded bg-[#ECEAF5]" />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <Card key={item} className="space-y-3 p-5">
            <div className="h-4 w-32 animate-pulse rounded bg-[#ECEAF5]" />
            <div className="h-8 w-20 animate-pulse rounded bg-[#F1EFF8]" />
          </Card>
        ))}
      </div>
      <Card className="space-y-4 p-5" aria-hidden="true">
        <div className="h-6 w-48 animate-pulse rounded bg-[#ECEAF5]" />
        {[0, 1].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-xl bg-[#F1EFF8]" />
        ))}
      </Card>
    </div>
  );
}
