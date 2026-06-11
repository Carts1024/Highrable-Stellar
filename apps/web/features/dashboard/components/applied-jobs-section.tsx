"use client";

import { RouteEmptyState } from "@/features/common";
import { StatusPill } from "@/features/dashboard/components/status-pill";
import { useFreelancerAppliedJobs } from "@/features/dashboard/hooks/use-freelancer-applied-jobs";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { BriefcaseBusiness, ClipboardList } from "lucide-react";
import Link from "next/link";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

export function AppliedJobsSection() {
  const { items, isInitialLoading, canLoadMore, isLoadingMore, loadMore, nextPageSize } =
    useFreelancerAppliedJobs();

  return (
    <section className="space-y-5">
      <div className="space-y-0.5">
        <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
          Applications
        </p>
        <h2 className="hr-text-primary font-sans text-lg font-semibold">Applied jobs</h2>
        <p className="hr-text-secondary mt-1 text-sm">
          Jobs you applied to with your current application status.
        </p>
      </div>

      {isInitialLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-border/60 bg-muted/30"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <RouteEmptyState
          icon={<ClipboardList className="h-10 w-10" />}
          title="No applications yet"
          description="Browse the marketplace and apply to jobs to see them here."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <article
              key={item.applicationId}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-none transition-all duration-200 hover:border-highrable-orange-3/30 hover:shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="hr-text-primary truncate text-base font-bold transition-colors group-hover:text-highrable-orange-3">
                    {item.title}
                  </h3>
                  {item.milestoneTitle ? (
                    <p className="hr-text-muted truncate text-xs font-medium">
                      Milestone: {item.milestoneTitle}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-sans text-lg leading-none font-bold tracking-tight text-highrable-orange-3">
                    {formatAmount(item.budget)} {formatAsset(item.asset)}
                  </p>
                  <p className="mt-1 font-mono text-[10px] tracking-[0.08em] text-muted-foreground/60 uppercase">
                    Budget
                  </p>
                </div>
              </div>

              {item.proposalPreview ? (
                <p className="hr-text-secondary line-clamp-2 text-sm leading-relaxed">
                  {item.proposalPreview}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border-y border-border/80 bg-muted/50 px-4 py-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] tracking-wide text-muted-foreground/50 uppercase">
                    Applied
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatDate(item.applicationCreatedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] tracking-wide text-muted-foreground/50 uppercase">
                    Application
                  </span>
                  <StatusPill label={item.derivedApplicationStatus} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] tracking-wide text-muted-foreground/50 uppercase">
                    Job
                  </span>
                  <StatusPill label={item.jobStatus} />
                </div>
                {item.escrowStatus ? (
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] tracking-wide text-muted-foreground/50 uppercase">
                      Escrow
                    </span>
                    <StatusPill label={item.escrowStatus} />
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end">
                <AppButton
                  asChild
                  variant="outline"
                  className="h-9 gap-2 rounded-lg px-4 text-xs font-semibold hover:bg-muted/60"
                >
                  <Link href={`/marketplace/jobs/${item.jobId}`}>
                    <BriefcaseBusiness className="h-3.5 w-3.5" />
                    View
                  </Link>
                </AppButton>
              </div>
            </article>
          ))}
        </div>
      )}

      {(canLoadMore || isLoadingMore) && (
        <div className="flex justify-end">
          <AppButton
            variant="outline"
            onClick={() => loadMore(nextPageSize)}
            disabled={!canLoadMore || isLoadingMore}
            className="h-9 rounded-lg px-4 text-xs font-semibold"
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </AppButton>
        </div>
      )}
    </section>
  );
}
