"use client";

import { RouteEmptyState, SectionHeading } from "@/features/common";
import {
  LoadMoreButton,
  WorkList,
  WorkListRow,
  WorkListSkeleton,
  WorkMeta,
} from "@/features/common/components/work-list";
import { StatusPill } from "@/features/dashboard/components/status-pill";
import { useClientPostedJobs } from "@/features/dashboard/hooks/use-client-posted-jobs";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { DeadlineBadge } from "@/features/deadlines";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import Link from "next/link";
import React from "react";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

export function PostedJobsSection() {
  const { items, isInitialLoading, canLoadMore, isLoadingMore, loadMore, nextPageSize } =
    useClientPostedJobs();

  return (
    <section className="space-y-3">
      <SectionHeading title="Posted jobs" />

      {isInitialLoading ? (
        <WorkListSkeleton />
      ) : items.length === 0 ? (
        <RouteEmptyState
          title="You have not posted a job yet"
          description="Once you post a job, applications and payment progress show up here."
          action={
            <Link href="/post-job" className="hr-mode-text text-sm font-medium hover:underline">
              Post your first job
            </Link>
          }
        />
      ) : (
        <WorkList>
          {items.map((item) => (
            <WorkListRow
              key={item.jobId}
              href={`/marketplace/jobs/${item.jobId}`}
              title={item.title}
              amount={`${formatAmount(item.budget)} ${formatAsset(item.asset)}`}
              status={
                <>
                  <StatusPill label={item.jobStatus} />
                  {item.escrowStatus ? (
                    <>
                      <span className="hr-text-muted text-xs">Payment hold</span>
                      <StatusPill label={item.escrowStatus} />
                    </>
                  ) : null}
                  <DeadlineBadge
                    deadlineAt={item.deadlineAt}
                    submittedAt={item.submittedAt}
                    completedAt={item.completedAt}
                    approvedAt={item.approvedAt}
                    escrowStatus={item.escrowStatus}
                    workStatus={item.jobStatus}
                    compact
                  />
                </>
              }
              meta={
                <>
                  <WorkMeta label="Applicants">{item.applicationCount}</WorkMeta>
                  {item.selectedFreelancerWallet ? (
                    <WorkMeta label="Hired">
                      <span className="font-mono">
                        {shortenWalletAddress(item.selectedFreelancerWallet)}
                      </span>
                    </WorkMeta>
                  ) : null}
                  <WorkMeta label="Posted">{formatDate(item.createdAt)}</WorkMeta>
                </>
              }
            />
          ))}
        </WorkList>
      )}

      <LoadMoreButton
        canLoadMore={canLoadMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={() => loadMore(nextPageSize)}
      />
    </section>
  );
}
