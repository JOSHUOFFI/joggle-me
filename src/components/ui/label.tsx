import * as React from "react";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`mb-1.5 block text-sm font-semibold text-[#17152A] ${className ?? ""}`}
      {...props}
    />
  );
}
