import { RouteEmptyState } from "@/features/common";
import { Briefcase } from "lucide-react";

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
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-44 animate-pulse rounded-xl border border-border/60 bg-muted/30"
          />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <RouteEmptyState
        icon={<Briefcase className="h-10 w-10" />}
        title="No matching jobs"
        description="Adjust the search or create the first job."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
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
    </div>
  );
}
