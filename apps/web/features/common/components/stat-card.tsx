import { cn } from "@repo/ui/lib/utils";
import React from "react";

import type { ReactNode } from "react";

interface IStatCardProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly description?: ReactNode;
  readonly className?: string;
}

/** A single figure with its label. Group several inside a `divide-x` row rather than separate boxes. */
export function StatCard({ label, value, description, className }: IStatCardProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="hr-text-secondary font-sans text-xs">{label}</p>
      <div className="hr-text-primary hr-num mt-1 truncate font-sans text-xl leading-tight font-semibold">
        {value}
      </div>
      {description ? (
        <p className="hr-text-muted mt-1 font-sans text-xs leading-snug">{description}</p>
      ) : null}
    </div>
  );
}
