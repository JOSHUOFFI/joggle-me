import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-[#DDD8EF] bg-white px-3 text-sm text-[#17152A] outline-none transition placeholder:text-[#77758A] focus:border-[#7655D9] focus:ring-4 focus:ring-[#7655D9]/10",
        className,
      )}
      {...props}
    />
  );
}
