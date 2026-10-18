"use client";

import { RouteEmptyState } from "@/features/common";
import {
  LoadMoreButton,
  WorkList,
  WorkListRow,
  WorkListSkeleton,
  WorkMeta,
} from "@/features/common/components/work-list";
import { StatusPill } from "@/features/dashboard/components/status-pill";
import { useFreelancerOngoingJobs } from "@/features/dashboard/hooks/use-freelancer-ongoing-jobs";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { DeadlineBadge } from "@/features/deadlines";
import { JobSafetyBadge } from "@/features/marketplace/components/job-safety-badge";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import React from "react";

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function OngoingJobsSection() {
  const { items, isInitialLoading, canLoadMore, isLoadingMore, loadMore, nextPageSize } =
    useFreelancerOngoingJobs();

  if (isInitialLoading) {
    return <WorkListSkeleton />;
  }

  if (items.length === 0) {
    return (
      <RouteEmptyState
        title="Nothing in progress"
        description="Jobs appear here once a client picks you and sets the payment aside."
      />
    );
  }

  return (
    <div className="space-y-3">
      <WorkList>
        {items.map((item) => (
          <WorkListRow
            key={item.escrowId}
            href={`/marketplace/jobs/${item.jobId}`}
            title={item.title}
            subtitle={item.milestoneTitle ? `Milestone: ${item.milestoneTitle}` : undefined}
            amount={`${formatAmount(item.budget)} ${formatAsset(item.asset)}`}
            amountLabel="On hold"
            status={
              <>
                <JobSafetyBadge status="verified_funded" compact />
                <StatusPill label={item.escrowStatus} />
                <DeadlineBadge
                  deadlineAt={item.deadlineAt}
                  submittedAt={item.submittedAt}
                  completedAt={item.completedAt}
                  approvedAt={item.approvedAt}
                  escrowStatus={item.escrowStatus}
                  compact
                />
              </>
            }
            meta={
              <>
                <WorkMeta label="Client">
                  <span className="font-mono">{shortenWalletAddress(item.clientWallet)}</span>
                </WorkMeta>
                <WorkMeta label="Updated">{formatDateTime(item.updatedAt)}</WorkMeta>
              </>
            }
          />
        ))}
      </WorkList>
      <LoadMoreButton
        canLoadMore={canLoadMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={() => loadMore(nextPageSize)}
      />
    </div>
  );
}
