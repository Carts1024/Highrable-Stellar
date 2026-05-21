"use client";

import { StatusPill } from "@/features/dashboard/components/status-pill";
import { useFreelancerOngoingJobs } from "@/features/dashboard/hooks/use-freelancer-ongoing-jobs";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { DeadlineBadge } from "@/features/deadlines";
import { JobSafetyBadge } from "@/features/marketplace/components/job-safety-badge";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Briefcase } from "lucide-react";
import Link from "next/link";

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function OngoingJobsSection() {
  const { items, isInitialLoading, canLoadMore, isLoadingMore, loadMore, nextPageSize } =
    useFreelancerOngoingJobs();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>Ongoing Jobs</SectionLabel>
          <h2 className="mt-2 text-lg font-semibold text-[#0a0a0a]">Active work</h2>
          <p className="mt-1 text-sm text-[#5f5f5f]">
            Active funded or submitted payment engagements in progress.
          </p>
        </div>
      </div>

      <div className="border-y border-[#e8e8e8]">
        {isInitialLoading ? (
          <p className="px-1 py-5 text-sm text-[#5f5f5f] sm:px-4">Loading ongoing jobs...</p>
        ) : items.length === 0 ? (
          <p className="bg-[#fafafa] px-1 py-10 text-center text-sm text-[#5f5f5f] sm:px-4">
            No ongoing jobs right now.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Escrow</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.escrowId} className="hover:bg-[#fff7ed]/40">
                  <TableCell className="max-w-60 font-medium">
                    <p className="hr-text-primary truncate">{item.title}</p>
                    {item.milestoneTitle ? (
                      <p className="hr-text-muted truncate text-xs font-normal">
                        Milestone: {item.milestoneTitle}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <JobSafetyBadge status="verified_funded" compact />
                      <StatusPill label={item.escrowStatus} />
                    </div>
                  </TableCell>
                  <TableCell>{formatDateTime(item.updatedAt)}</TableCell>
                  <TableCell>
                    <DeadlineBadge
                      deadlineAt={item.deadlineAt}
                      submittedAt={item.submittedAt}
                      completedAt={item.completedAt}
                      approvedAt={item.approvedAt}
                      escrowStatus={item.escrowStatus}
                      compact
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {shortenWalletAddress(item.clientWallet)}
                  </TableCell>
                  <TableCell>
                    {formatAmount(item.budget)} {formatAsset(item.asset)}
                  </TableCell>
                  <TableCell className="text-right">
                    <AppButton
                      asChild
                      variant="secondary"
                      className="h-8 rounded-none px-3 text-xs"
                    >
                      <Link href={`/marketplace/jobs/${item.jobId}`}>
                        <Briefcase className="h-3.5 w-3.5" />
                        Open
                      </Link>
                    </AppButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {(canLoadMore || isLoadingMore) && (
        <div className="flex justify-end">
          <AppButton
            variant="secondary"
            onClick={() => loadMore(nextPageSize)}
            disabled={!canLoadMore || isLoadingMore}
            className="rounded-none"
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </AppButton>
        </div>
      )}
    </section>
  );
}
