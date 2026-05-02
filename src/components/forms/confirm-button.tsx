"use client";

import { cn } from "@/lib/utils";

interface ConfirmButtonProps {
  label: string;
  message: string;
  className?: string;
}

export function ConfirmButton({
  label,
  message,
  className,
}: ConfirmButtonProps) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--danger-300)] hover:text-[var(--danger-600)]",
        className,
      )}
    >
      {label}
    </button>
  );
}
