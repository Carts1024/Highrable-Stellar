import { cn } from "@repo/ui/lib/utils";
import React from "react";

import type { ReactNode } from "react";

export type TStatusTone = "neutral" | "info" | "warning" | "success" | "danger";

const DOT_CLASSES: Record<TStatusTone, string> = {
  neutral: "bg-zinc-400",
  info: "bg-sky-500",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  danger: "bg-red-500",
};

interface IStatusTextProps {
  readonly tone?: TStatusTone;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Status as plain text with a small coloured dot. The dot carries the meaning; the text stays readable. */
export function StatusText({ tone = "neutral", children, className }: IStatusTextProps) {
  return (
    <span
      className={cn(
        "hr-text-primary inline-flex items-center gap-1.5 font-sans text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[tone])}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}
