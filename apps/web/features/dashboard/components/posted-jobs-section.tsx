"use client";

import { StatusPill } from "@/features/dashboard/components/status-pill";
import { useClientPostedJobs } from "@/features/dashboard/hooks/use-client-posted-jobs";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { DeadlineBadge } from "@/features/deadlines";
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
import { PlusSquare } from "lucide-react";
import Link from "next/link";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

export function PostedJobsSection() {
  const { items, isInitialLoading, canLoadMore, isLoadingMore, loadMore, nextPageSize } =
    useClientPostedJobs();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>Posted Jobs</SectionLabel>
          <h2 className="mt-2 text-lg font-semibold text-[#0a0a0a]">Client work board</h2>
          <p className="mt-1 text-sm text-[#5f5f5f]">
            Jobs you posted with applicant volume and current progress.
          </p>
        </div>
        <AppButton asChild variant="outline" className="h-9 rounded-none px-3 text-xs">
          <Link href="/post-job">
            <PlusSquare className="h-3.5 w-3.5" />
            Post a job
          </Link>
        </AppButton>
      </div>

      <div className="border-y border-[#e8e8e8]">
        {isInitialLoading ? (
          <p className="px-1 py-5 text-sm text-[#5f5f5f] sm:px-4">Loading posted jobs...</p>
        ) : items.length === 0 ? (
          <p className="bg-[#fafafa] px-1 py-10 text-center text-sm text-[#5f5f5f] sm:px-4">
            You have not posted any jobs yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Escrow</TableHead>
                <TableHead>Applicants</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Selected</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.jobId} className="hover:bg-[#fff7ed]/40">
                  <TableCell className="hr-text-primary max-w-55 truncate font-medium">
                    {item.title}
                  </TableCell>
                  <TableCell>{formatDate(item.createdAt)}</TableCell>
                  <TableCell>
                    <StatusPill label={item.jobStatus} />
                  </TableCell>
                  <TableCell>
                    {item.escrowStatus ? <StatusPill label={item.escrowStatus} /> : "-"}
                  </TableCell>
                  <TableCell>{item.applicationCount}</TableCell>
                  <TableCell>
                    <DeadlineBadge
                      deadlineAt={item.deadlineAt}
                      submittedAt={item.submittedAt}
                      completedAt={item.completedAt}
                      approvedAt={item.approvedAt}
                      escrowStatus={item.escrowStatus}
                      workStatus={item.jobStatus}
                      compact
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {shortenWalletAddress(item.selectedFreelancerWallet)}
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
                      <Link href={`/marketplace/jobs/${item.jobId}`}>Manage</Link>
                    </AppButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex justify-end">
        {(canLoadMore || isLoadingMore) && (
          <AppButton
            variant="secondary"
            onClick={() => loadMore(nextPageSize)}
            disabled={!canLoadMore || isLoadingMore}
            className="rounded-none"
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </AppButton>
        )}
      </div>
    </section>
  );
}
