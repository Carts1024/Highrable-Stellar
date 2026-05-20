"use client";

import { StatusPill } from "@/features/dashboard/components/status-pill";
import { useClientPostedJobs } from "@/features/dashboard/hooks/use-client-posted-jobs";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { DeadlineBadge } from "@/features/deadlines";
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
import { PlusSquare, Users } from "lucide-react";
import Link from "next/link";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

export function PostedJobsSection() {
  const { items, isInitialLoading, canLoadMore, isLoadingMore, loadMore, nextPageSize } =
    useClientPostedJobs();

  return (
    <Card className="border-[#e8e8e8] bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#0a0a0a]">
          <Users className="h-5 w-5 text-[#FF7003]" />
          Posted Jobs
        </CardTitle>
        <CardDescription>
          Jobs you posted with applicant volume and current progress.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isInitialLoading ? (
          <p className="text-sm text-gray-500">Loading posted jobs...</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
            <p className="text-sm text-gray-500">You have not posted any jobs yet.</p>
          </div>
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
                <TableRow key={item.jobId}>
                  <TableCell className="max-w-55 truncate font-medium">{item.title}</TableCell>
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
                  <TableCell className="font-mono text-xs text-gray-600">
                    {shortenWalletAddress(item.selectedFreelancerWallet)}
                  </TableCell>
                  <TableCell>
                    {formatAmount(item.budget)} {formatAsset(item.asset)}
                  </TableCell>
                  <TableCell className="text-right">
                    <AppButton asChild variant="secondary" className="h-8 px-3 text-xs">
                      <Link href={`/marketplace/jobs/${item.jobId}`}>Manage</Link>
                    </AppButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter className="justify-between border-t pt-4">
        <AppButton asChild variant="outline" className="h-8 px-3 text-xs">
          <Link href="/post-job">
            <PlusSquare className="h-3.5 w-3.5" />
            Post a job
          </Link>
        </AppButton>
        {(canLoadMore || isLoadingMore) && (
          <AppButton
            variant="secondary"
            onClick={() => loadMore(nextPageSize)}
            disabled={!canLoadMore || isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </AppButton>
        )}
      </CardFooter>
    </Card>
  );
}
