"use client";

import { StatusPill } from "@/features/dashboard/components/status-pill";
import { useFreelancerOngoingJobs } from "@/features/dashboard/hooks/use-freelancer-ongoing-jobs";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { DeadlineBadge } from "@/features/deadlines";
import { JobSafetyBadge } from "@/features/marketplace/components/job-safety-badge";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Briefcase, PlayCircle } from "lucide-react";
import Link from "next/link";

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function OngoingJobsSection() {
  const { items, isInitialLoading, canLoadMore, isLoadingMore, loadMore, nextPageSize } =
    useFreelancerOngoingJobs();

  return (
    <Card className="border-[#e8e8e8] bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#0a0a0a]">
          <PlayCircle className="h-5 w-5 text-[#FF7003]" />
          Ongoing Jobs
        </CardTitle>
        <CardDescription>
          Active funded or submitted escrow engagements in progress.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isInitialLoading ? (
          <p className="text-sm text-gray-500">Loading ongoing jobs...</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
            <p className="text-sm text-gray-500">No ongoing jobs right now.</p>
          </div>
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
                <TableRow key={item.escrowId}>
                  <TableCell className="max-w-60 font-medium">
                    <p className="truncate">{item.title}</p>
                    {item.milestoneTitle ? (
                      <p className="truncate text-xs font-normal text-gray-500">
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
                  <TableCell className="font-mono text-xs text-gray-600">
                    {shortenWalletAddress(item.clientWallet)}
                  </TableCell>
                  <TableCell>
                    {formatAmount(item.budget)} {formatAsset(item.asset)}
                  </TableCell>
                  <TableCell className="text-right">
                    <AppButton asChild variant="secondary" className="h-8 px-3 text-xs">
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
      </CardContent>
      {(canLoadMore || isLoadingMore) && (
        <CardFooter className="justify-end border-t pt-4">
          <AppButton
            variant="secondary"
            onClick={() => loadMore(nextPageSize)}
            disabled={!canLoadMore || isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </AppButton>
        </CardFooter>
      )}
    </Card>
  );
}
