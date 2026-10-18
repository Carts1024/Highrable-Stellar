import { cn } from "@repo/ui/lib/utils";
import React from "react";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface ISectionCardProps {
  /** What this container is, in a few plain words. Shown on the coloured band. */
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly icon?: LucideIcon;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly bodyClassName?: string;
  readonly id?: string;
}

/**
 * Standard container: white card with a coloured heading band on top, so every box on a page
 * says what it is before you read the content. The band follows the current mode colour.
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
  id,
}: ISectionCardProps) {
  return (
    <section
      id={id}
      className={cn("overflow-hidden rounded-xl border bg-card text-card-foreground", className)}
    >
      <header className="hr-card-head flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/85 text-[var(--mode-text)]">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="font-sans text-base leading-tight font-bold sm:text-lg">{title}</h2>
            {description ? (
              <p className="mt-0.5 font-sans text-xs leading-snug opacity-90 sm:text-sm">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </header>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

interface ISectionHeadingProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly icon?: LucideIcon;
  readonly action?: ReactNode;
  readonly className?: string;
}

/** Stand-alone coloured heading band for a group of cards (a list, a board, a set of shortcuts). */
export function SectionHeading({
  title,
  description,
  icon: Icon,
  action,
  className,
}: ISectionHeadingProps) {
  return (
    <div
      className={cn(
        "hr-card-head flex flex-wrap items-center justify-between gap-3 rounded-xl px-5 py-3.5 shadow-sm",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/85 text-[var(--mode-text)]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="font-sans text-base leading-tight font-bold sm:text-lg">{title}</h2>
          {description ? (
            <p className="mt-0.5 font-sans text-xs leading-snug opacity-90 sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
