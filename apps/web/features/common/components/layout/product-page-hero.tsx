import { cn } from "@repo/ui/lib/utils";
import React from "react";

import type { ReactNode } from "react";

interface IProductPageHeroProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Small context line above the title, such as a case number or a back link. */
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
}

/** Page title row for product routes: title and short description, with actions on the right. */
export function ProductPageHero({
  title,
  description,
  meta,
  actions,
  className,
}: IProductPageHeroProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {meta ? <div className="hr-text-muted font-mono text-xs">{meta}</div> : null}
        <h1 className="hr-text-primary font-sans text-2xl leading-tight font-semibold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="hr-text-secondary max-w-2xl text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
