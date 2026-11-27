import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#ECEAF5] bg-white shadow-[0_12px_40px_rgba(53,33,107,0.07)]",
        className,
      )}
      {...props}
    />
  );
}
