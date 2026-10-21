import {
  formatShortDate,
  getClientWorkTypeLabel,
} from "@/features/client-profile/lib/client-profile-format";
import { RouteEmptyState, WorkList, WorkListRow, WorkMeta } from "@/features/common";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { StatusBadge } from "@/features/marketplace/components/status-badge";
import React from "react";

import type { TClientRecentJob } from "@/features/client-profile/types";

export function RecentClientJobsSection({ jobs }: { readonly jobs: readonly TClientRecentJob[] }) {
  if (jobs.length === 0) {
    return <RouteEmptyState description="This client has not posted any jobs yet." />;
  }

  return (
    <WorkList>
      {jobs.map((job) => (
        <WorkListRow
          key={job.jobId}
          href={`/marketplace/jobs/${job.jobId}`}
          title={job.title}
          amount={`${formatAmount(job.totalBudget)} ${formatAsset(job.asset)}`}
          status={<StatusBadge label={job.status} />}
          meta={
            <>
              <span>{getClientWorkTypeLabel(job.jobType)}</span>
              <WorkMeta label="Posted">{formatShortDate(job.createdAt)}</WorkMeta>
            </>
          }
        />
      ))}
    </WorkList>
  );
}
