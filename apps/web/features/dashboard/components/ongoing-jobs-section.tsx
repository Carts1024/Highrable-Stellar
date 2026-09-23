"use client";

import { RouteEmptyState } from "@/features/common";
import { StatusPill } from "@/features/dashboard/components/status-pill";
import { useFreelancerOngoingJobs } from "@/features/dashboard/hooks/use-freelancer-ongoing-jobs";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { DeadlineBadge } from "@/features/deadlines";
import { JobSafetyBadge } from "@/features/marketplace/components/job-safety-badge";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Briefcase, User } from "lucide-react";
import Link from "next/link";

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function OngoingJobsSection() {
  const { items, isInitialLoading, canLoadMore, isLoadingMore, loadMore, nextPageSize } =
    useFreelancerOngoingJobs();

  return (
    <section className="space-y-5">
      <div className="space-y-0.5">
        <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
          Ongoing Jobs
        </p>
        <h2 className="hr-text-primary font-sans text-lg font-semibold">Active work</h2>
        <p className="hr-text-secondary mt-1 text-sm">
          Active funded or submitted payment engagements in progress.
        </p>
      </div>

      {isInitialLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl border border-border/60 bg-muted/30"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <RouteEmptyState
          icon={<Briefcase className="h-10 w-10" />}
          title="No ongoing jobs"
          description="Funded or submitted engagements will show up here once you're selected."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <article
              key={item.escrowId}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-none transition-all duration-200 hover:border-highrable-orange-3/30 hover:shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <JobSafetyBadge status="verified_funded" compact />
                    <StatusPill label={item.escrowStatus} />
                  </div>
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

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border-y border-border/80 bg-muted/50 px-4 py-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] tracking-wide text-muted-foreground/50 uppercase">
                    Updated
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatDateTime(item.updatedAt)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] tracking-wide text-muted-foreground/50 uppercase">
                    Deadline
                  </span>
                  <DeadlineBadge
                    deadlineAt={item.deadlineAt}
                    submittedAt={item.submittedAt}
                    completedAt={item.completedAt}
                    approvedAt={item.approvedAt}
                    escrowStatus={item.escrowStatus}
                    compact
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <span className="font-mono text-[11px] tracking-wide text-muted-foreground/50 uppercase">
                    Client
                  </span>
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {shortenWalletAddress(item.clientWallet)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <AppButton
                  asChild
                  variant="outline"
                  className="h-9 gap-2 rounded-lg px-4 text-xs font-semibold hover:bg-muted/60"
                >
                  <Link href={`/marketplace/jobs/${item.jobId}`}>
                    <Briefcase className="h-3.5 w-3.5" />
                    Open
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
