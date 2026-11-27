"use client";

import type { ButtonHTMLAttributes } from "react";

type ConfirmActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  confirmation: string;
};

export function ConfirmActionButton({
  confirmation,
  onClick,
  ...props
}: ConfirmActionButtonProps) {
  return (
    <button
      {...props}
      type={props.type ?? "submit"}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !window.confirm(confirmation)) {
          event.preventDefault();
        }
      }}
    />
  );
}
