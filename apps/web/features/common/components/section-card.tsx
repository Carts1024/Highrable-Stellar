import { cn } from "@repo/ui/lib/utils";
import React from "react";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface ISectionCardProps {
  /** What this container is, in a few plain words. */
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Optional small glyph before the title. Use only when it helps recognition. */
  readonly icon?: LucideIcon;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly bodyClassName?: string;
  readonly id?: string;
}

/** Bordered container with a plain title row. Use for content that needs its own boundary. */
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
      className={cn("overflow-hidden rounded-lg border bg-card text-card-foreground", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div className="min-w-0">
          <h2 className="hr-text-primary flex items-center gap-2 font-sans text-sm font-semibold">
            {Icon ? <Icon className="hr-text-muted h-4 w-4 shrink-0" aria-hidden="true" /> : null}
            {title}
          </h2>
          {description ? (
            <p className="hr-text-secondary mt-0.5 font-sans text-xs leading-snug">{description}</p>
          ) : null}
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

/** Heading for a group of items that sits on the page rather than inside a container. */
export function SectionHeading({
  title,
  description,
  icon: Icon,
  action,
  className,
}: ISectionHeadingProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="hr-text-primary flex items-center gap-2 font-sans text-base font-semibold">
          {Icon ? <Icon className="hr-text-muted h-4 w-4 shrink-0" aria-hidden="true" /> : null}
          {title}
        </h2>
        {description ? (
          <p className="hr-text-secondary mt-0.5 font-sans text-sm leading-snug">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
