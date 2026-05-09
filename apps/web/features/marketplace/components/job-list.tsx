import type { TConvexDoc } from "@repo/convex-client";

import { JobCard } from "./job-card";

interface IJobListProps {
  readonly jobs: TConvexDoc<"jobs">[] | undefined;
  readonly connectedWallet: string | null;
  readonly onApply: (jobId: string) => void;
  readonly applyingJobId: string | null;
}

export function JobList({ jobs, connectedWallet, onApply, applyingJobId }: IJobListProps) {
  if (jobs === undefined) {
    return <p className="text-sm text-[#7f7f7f]">Loading jobs...</p>;
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#e8e8e8] bg-[#f5f5f5] p-8 text-center text-sm text-[#5f5f5f]">
        No open jobs yet. Create the first job.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {jobs.map((job) => (
        <JobCard
          key={job._id}
          job={job}
          connectedWallet={connectedWallet}
          onApply={onApply}
          isApplying={applyingJobId === job._id}
        />
      ))}
    </div>
  );
}
