import type { TMarketplaceJobRow } from "@/features/marketplace/types";
import type { TConvexDoc } from "@repo/convex-client";

import { JobCard } from "./job-card";

interface IJobListProps {
  readonly jobs: TMarketplaceJobRow[] | TConvexDoc<"jobs">[] | undefined;
  readonly connectedWallet: string | null;
  readonly onApply: (jobId: string) => void;
  readonly applyingJobId: string | null;
}

export function JobList({ jobs, connectedWallet, onApply, applyingJobId }: IJobListProps) {
  if (jobs === undefined) {
    return (
      <div className="grid gap-4">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-36 animate-pulse border border-gray-100 bg-gray-50" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="border border-dashed border-[#e8e8e8] bg-[#f5f5f5] p-8 text-center text-sm text-[#5f5f5f]">
        No matching jobs yet. Adjust the search or create the first job.
      </div>
    );
  }

  return (
    <div className="border-y border-[#e8e8e8]">
      {jobs.map((job) =>
        "job" in job ? (
          <JobCard
            key={job.job._id}
            job={job.job}
            escrow={job.escrow}
            connectedWallet={connectedWallet}
            onApply={onApply}
            isApplying={applyingJobId === job.job._id}
          />
        ) : (
          <JobCard
            key={job._id}
            job={job}
            connectedWallet={connectedWallet}
            onApply={onApply}
            isApplying={applyingJobId === job._id}
          />
        ),
      )}
    </div>
  );
}
