import type { TConvexDoc } from "@repo/convex-client";

import { JobCard } from "./job-card";

export function JobList({
  jobs,
  connectedWallet,
  onApply,
  applyingJobId,
}: {
  jobs: TConvexDoc<"jobs">[] | undefined;
  connectedWallet: string | null;
  onApply: (jobId: string) => void;
  applyingJobId: string | null;
}) {
  if (jobs === undefined) {
    return <p className="text-sm text-gray-500">Loading jobs...</p>;
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
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
