import { RouteEmptyState } from "@/features/common";
import React from "react";

import type { TMarketplaceJobRow } from "@/features/marketplace/types";
import type { TConvexDoc } from "@repo/convex-client";

import { JobCard } from "./job-card";

interface IJobListProps {
  readonly jobs: TMarketplaceJobRow[] | TConvexDoc<"jobs">[] | undefined;
  readonly connectedWallet: string | null;
  readonly onApply: (jobId: string) => void;
  readonly applyingJobId: string | null;
  readonly appliedJobIds: ReadonlySet<string> | undefined;
}

export function JobList({
  jobs,
  connectedWallet,
  onApply,
  applyingJobId,
  appliedJobIds,
}: IJobListProps) {
  if (jobs === undefined) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div key={item} className="space-y-2 rounded-lg border px-5 py-4">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <RouteEmptyState
        title="No jobs match"
        description="Try a different search, or show all jobs instead of verified only."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {jobs.map((job) =>
        "job" in job ? (
          <JobCard
            key={job.job._id}
            job={job.job}
            escrow={job.escrow}
            connectedWallet={connectedWallet}
            onApply={onApply}
            isApplying={applyingJobId === job.job._id}
            hasApplied={appliedJobIds?.has(job.job._id) ?? false}
            isCheckingApplicationStatus={!!connectedWallet && appliedJobIds === undefined}
          />
        ) : (
          <JobCard
            key={job._id}
            job={job}
            connectedWallet={connectedWallet}
            onApply={onApply}
            isApplying={applyingJobId === job._id}
            hasApplied={appliedJobIds?.has(job._id) ?? false}
            isCheckingApplicationStatus={!!connectedWallet && appliedJobIds === undefined}
          />
        ),
      )}
    </ul>
  );
}
