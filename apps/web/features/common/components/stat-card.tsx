import { cn } from "@repo/ui/lib/utils";
import React from "react";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type TStatTone = "orange" | "yellow" | "green" | "sky" | "violet" | "rose";

interface IStatCardProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly description?: ReactNode;
  readonly icon: LucideIcon;
  readonly tone?: TStatTone;
  readonly className?: string;
}

/** Summary number with an icon and a pastel background so each card is easy to tell apart. */
export function StatCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "orange",
  className,
}: IStatCardProps) {
  return (
    <div className={cn(`hr-tone-${tone} hr-tone-card rounded-xl p-4 shadow-sm`, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-sans text-sm font-semibold" style={{ color: "var(--tone-fg)" }}>
            {label}
          </p>
          <div className="hr-text-primary mt-1.5 truncate font-sans text-2xl leading-none font-bold">
            {value}
          </div>
        </div>
        <span className="hr-tone-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      {description ? (
        <p className="hr-text-secondary mt-2.5 font-sans text-xs leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}
