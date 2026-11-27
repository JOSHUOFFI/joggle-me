import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export default function CommunityLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading community">
      <div className="mb-5" aria-hidden="true"><Logo variant="symbol" /></div>
      <span className="sr-only">Loading community…</span>
      <div className="mb-6 flex flex-wrap gap-2" aria-hidden="true">
        {["w-16", "w-40", "w-28", "w-32"].map((width, index) => (
          <div key={index} className={`h-10 animate-pulse rounded-xl bg-[#ECEAF5] ${width}`} />
        ))}
      </div>
      <div className="mb-6 space-y-2" aria-hidden="true">
        <div className="h-4 w-32 animate-pulse rounded bg-[#ECEAF5]" />
        <div className="h-9 w-64 max-w-full animate-pulse rounded bg-[#ECEAF5]" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-[#ECEAF5]" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(270px,.7fr)]">
        <div className="space-y-4" aria-hidden="true">
          {[0, 1].map((item) => (
            <Card key={item} className="space-y-4 p-5 sm:p-6">
              <div className="h-5 w-40 animate-pulse rounded bg-[#ECEAF5]" />
              <div className="h-24 animate-pulse rounded-xl bg-[#F1EFF8]" />
              <div className="h-4 w-28 animate-pulse rounded bg-[#ECEAF5]" />
            </Card>
          ))}
        </div>
        <Card className="space-y-4 p-5 sm:p-6" aria-hidden="true">
          <div className="h-6 w-48 animate-pulse rounded bg-[#ECEAF5]" />
          <div className="h-32 animate-pulse rounded-xl bg-[#F1EFF8]" />
          <div className="h-10 animate-pulse rounded-xl bg-[#ECEAF5]" />
        </Card>
      </div>
    </div>
  );
}
