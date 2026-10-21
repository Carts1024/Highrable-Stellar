import { Button as AppButton } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import React from "react";

import type { ReactNode } from "react";

/** List of separate clickable containers. */
export function WorkList({ children }: { readonly children: ReactNode }) {
  return <ul className="flex flex-col gap-3">{children}</ul>;
}

interface IWorkListRowProps {
  readonly href: string;
  readonly title: string;
  readonly subtitle?: ReactNode;
  /** Status markers shown next to the title. */
  readonly status?: ReactNode;
  /** Secondary facts (dates, counterparty) shown on one wrapping line. */
  readonly meta?: ReactNode;
  readonly amount: ReactNode;
  readonly amountLabel?: string;
  /** Extra content under the row, such as a review. */
  readonly children?: ReactNode;
}

export function WorkListRow({
  href,
  title,
  subtitle,
  status,
  meta,
  amount,
  amountLabel = "Budget",
  children,
}: IWorkListRowProps) {
  return (
    <li className="hr-clickable-card rounded-lg border bg-card px-4 py-4 transition-colors hover:border-(--mode-border) hover:bg-muted/30 sm:px-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <Link
            href={href}
            className="hr-card-link hr-text-primary block truncate text-base font-medium"
          >
            {title}
          </Link>
          {subtitle ? <p className="hr-text-muted truncate text-xs">{subtitle}</p> : null}
          {status ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{status}</div>
          ) : null}
          {meta ? (
            <div className="hr-text-secondary flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {meta}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="hr-text-primary hr-num text-sm font-semibold">{amount}</p>
          <p className="hr-text-muted text-xs">{amountLabel}</p>
        </div>
      </div>
      {children}
    </li>
  );
}

/** Label/value pair for the meta line of a row. */
export function WorkMeta({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="hr-text-muted">{label}</span>
      <span className="hr-text-primary">{children}</span>
    </span>
  );
}

export function WorkListSkeleton({ rows = 3 }: { readonly rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex justify-between gap-4 rounded-lg border px-5 py-4">
          <div className="w-2/3 space-y-2">
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

interface ILoadMoreProps {
  readonly canLoadMore: boolean;
  readonly isLoadingMore: boolean;
  readonly onLoadMore: () => void;
  readonly className?: string;
}

export function LoadMoreButton({
  canLoadMore,
  isLoadingMore,
  onLoadMore,
  className,
}: ILoadMoreProps) {
  if (!canLoadMore && !isLoadingMore) return null;

  return (
    <div className={cn("flex justify-center", className)}>
      <AppButton
        variant="ghost"
        onClick={onLoadMore}
        disabled={!canLoadMore || isLoadingMore}
        className="h-8 px-3 text-sm"
      >
        {isLoadingMore ? "Loading…" : "Load more"}
      </AppButton>
    </div>
  );
}
