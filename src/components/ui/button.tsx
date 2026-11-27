import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7655D9]/20 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[#35216B] text-white shadow-[0_8px_24px_rgba(53,33,107,0.18)] hover:bg-[#7655D9]",
        secondary:
          "border border-[#DDD8EF] bg-white text-[#35216B] hover:bg-[#F7F7FC]",
        ghost: "text-[#35216B] hover:bg-[#7655D9]/10",
        danger: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        default: "h-11",
        sm: "h-9 rounded-lg px-3",
        lg: "h-12 px-6",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
