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
import { useFreelancerAppliedJobs } from "@/features/dashboard/hooks/use-freelancer-applied-jobs";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import Link from "next/link";
import React from "react";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

export function AppliedJobsSection() {
  const { items, isInitialLoading, canLoadMore, isLoadingMore, loadMore, nextPageSize } =
    useFreelancerAppliedJobs();

  if (isInitialLoading) {
    return <WorkListSkeleton />;
  }

  if (items.length === 0) {
    return (
      <RouteEmptyState
        title="No applications yet"
        description="Jobs you apply for will be listed here with their status."
        action={
          <Link href="/marketplace" className="hr-mode-text text-sm font-medium hover:underline">
            Browse open jobs
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <WorkList>
        {items.map((item) => (
          <WorkListRow
            key={item.applicationId}
            href={`/marketplace/jobs/${item.jobId}`}
            title={item.title}
            subtitle={item.milestoneTitle ? `Milestone: ${item.milestoneTitle}` : undefined}
            amount={`${formatAmount(item.budget)} ${formatAsset(item.asset)}`}
            status={
              <>
                <StatusPill label={item.derivedApplicationStatus} />
                <span className="hr-text-muted text-xs">Job</span>
                <StatusPill label={item.jobStatus} />
                {item.escrowStatus ? (
                  <>
                    <span className="hr-text-muted text-xs">Payment hold</span>
                    <StatusPill label={item.escrowStatus} />
                  </>
                ) : null}
              </>
            }
            meta={<WorkMeta label="Applied">{formatDate(item.applicationCreatedAt)}</WorkMeta>}
          >
            {item.proposalPreview ? (
              <p className="hr-text-secondary mt-2 line-clamp-2 text-sm leading-relaxed">
                {item.proposalPreview}
              </p>
            ) : null}
          </WorkListRow>
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
